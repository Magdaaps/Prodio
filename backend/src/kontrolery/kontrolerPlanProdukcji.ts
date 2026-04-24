import { Request, Response } from 'express';
import { Prisma, PrismaClient, StatusZlecenia } from '@prisma/client';
import { zsynchronizujStatusZamowieniaPoZmianieZlecenia } from './kontrolerZlecenProdukcyjnych';

const prisma = new PrismaClient();

const STATUSY_KANBAN = ['STOP', 'W_TOKU', 'PAUZA', 'GOTOWE'] as const satisfies readonly StatusZlecenia[];

function obliczKosztyWpisu(czasStart: Date, czasStop: Date, kosztRbh: unknown, stawkaGodzinowa: unknown) {
  const sekundy = Math.max(0, Math.floor((czasStop.getTime() - czasStart.getTime()) / 1000));
  const godziny = sekundy / 3600;
  const rbh = Number(String(kosztRbh ?? 0).replace(',', '.')) || 0;
  const stawka = Number(String(stawkaGodzinowa ?? 0).replace(',', '.')) || 0;
  return {
    kosztMaszynyPln: Number((godziny * rbh).toFixed(2)),
    kosztPracownikaPln: Number((godziny * stawka).toFixed(2)),
  };
}

type StatusKanban = (typeof STATUSY_KANBAN)[number];
type TypPaneluTabletowego = 'PRODUKCJA' | 'PAKOWANIE';

type ZlecenieKanbanPayload = Prisma.ZlecenieProdukcyjneGetPayload<{
  include: {
    maszyna: true;
    zamowienie: {
      include: {
        klient: true;
        pozycje: {
          include: {
            produkt: {
              include: {
                grupa: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type ZleceniePaneluPayload = Prisma.ZlecenieProdukcyjneGetPayload<{
  include: {
    maszyna: {
      include: {
        panel: true;
      };
    };
    zamowienie: {
      include: {
        klient: true;
        pozycje: {
          include: {
            produkt: {
              include: {
                grupa: true;
              };
            };
          };
        };
      };
    };
  };
}>;

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function czyStatusKanban(value: unknown): value is StatusKanban {
  return typeof value === 'string' && STATUSY_KANBAN.includes(value as StatusKanban);
}

function czyTypPaneluTabletowego(value: unknown): value is TypPaneluTabletowego {
  return value === 'PRODUKCJA' || value === 'PAKOWANIE';
}

function roznicaSekund(start: Date, stop: Date | null) {
  if (!stop) return 0;
  return Math.max(0, Math.round((stop.getTime() - start.getTime()) / 1000));
}

function bezPracownika(pracownicyIds: number[], pracownikId: number) {
  return pracownicyIds.filter((id) => id !== pracownikId);
}

function pobierzProduktZeZlecenia(zamowienie: {
  pozycje: Array<{
    produkt: {
      id: number;
      nazwa: string;
      grupa: { id: number; nazwa: string } | null;
      zdjecie: string | null;
    };
  }>;
}) {
  return zamowienie.pozycje[0]?.produkt ?? null;
}

function formatujNazwePracownika(pracownik: { imie: string; nazwisko: string }) {
  return `${pracownik.imie} ${pracownik.nazwisko}`.trim();
}

async function pobierzPracownikowDlaHistorii(pracownicyIds: number[]) {
  if (!pracownicyIds.length) {
    return [];
  }

  const pracownicy = await prisma.pracownik.findMany({
    where: {
      id: { in: pracownicyIds },
      aktywny: true,
    },
    select: {
      id: true,
      imie: true,
      nazwisko: true,
      stanowisko: true,
      kolorAvatara: true,
    },
    orderBy: [{ imie: 'asc' }, { nazwisko: 'asc' }],
  });

  return pracownicy.map((pracownik) => ({
    id: pracownik.id,
    nazwa: formatujNazwePracownika(pracownik),
    stanowisko: pracownik.stanowisko ?? '',
    inicjaly: `${pracownik.imie[0] ?? ''}${pracownik.nazwisko[0] ?? ''}`.toUpperCase(),
    kolorAvatara: pracownik.kolorAvatara,
  }));
}

function mapujZlecenieNaKanban(zlecenie: ZlecenieKanbanPayload) {
  const produkt = pobierzProduktZeZlecenia(zlecenie.zamowienie);
  const procentPostepu =
    zlecenie.iloscPlan > 0 ? Math.min(100, (zlecenie.iloscWykonana / zlecenie.iloscPlan) * 100) : 0;

  return {
    id: zlecenie.id,
    numer: zlecenie.numer,
    status: zlecenie.status,
    iloscPlan: zlecenie.iloscPlan,
    iloscWykonana: zlecenie.iloscWykonana,
    procentPostepu,
    utworzonyW: zlecenie.utworzonyW,
    maszyna: {
      id: zlecenie.maszyna.id,
      nazwa: zlecenie.maszyna.nazwa,
    },
    zamowienie: {
      id: zlecenie.zamowienie.id,
      idProdio: zlecenie.zamowienie.idProdio,
      zewnetrznyNumer: zlecenie.zamowienie.zewnetrznyNumer,
    },
    klient: zlecenie.zamowienie.klient
      ? {
          id: zlecenie.zamowienie.klient.id,
          nazwa: zlecenie.zamowienie.klient.nazwa,
        }
      : null,
    produkt: produkt
      ? {
          id: produkt.id,
          nazwa: produkt.nazwa,
          grupa: produkt.grupa ? { id: produkt.grupa.id, nazwa: produkt.grupa.nazwa } : null,
          zdjecie: produkt.zdjecie,
        }
      : null,
  };
}

export async function pobierzPlanProdukcji(req: Request, res: Response): Promise<void> {
  try {
    const maszynaId = parseIntValue(req.query.maszynaId);
    const where: Prisma.ZlecenieProdukcyjneWhereInput = {
      aktywne: true,
      status: { in: [...STATUSY_KANBAN] },
      ...(maszynaId ? { maszynaId } : {}),
    };

    const zlecenia: ZlecenieKanbanPayload[] = await prisma.zlecenieProdukcyjne.findMany({
      where,
      orderBy: [{ utworzonyW: 'asc' }],
      include: {
        maszyna: true,
        zamowienie: {
          include: {
            klient: true,
            pozycje: {
              include: {
                produkt: {
                  include: {
                    grupa: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const dane: Record<StatusKanban, ReturnType<typeof mapujZlecenieNaKanban>[]> = {
      STOP: [],
      W_TOKU: [],
      PAUZA: [],
      GOTOWE: [],
    };

    zlecenia.forEach((zlecenie) => {
      dane[zlecenie.status as StatusKanban].push(mapujZlecenieNaKanban(zlecenie));
    });

    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac planu produkcji.' });
  }
}

export async function zaktualizujStatusZleceniaPlanu(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const status = req.body.status;

    if (!czyStatusKanban(status)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Przekazano nieprawidlowy status zlecenia.' });
      return;
    }

    const istnieje = await prisma.zlecenieProdukcyjne.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!istnieje) {
      res.status(404).json({ sukces: false, wiadomosc: 'Zlecenie produkcyjne nie istnieje.' });
      return;
    }

    const zlecenie: ZlecenieKanbanPayload = await prisma.zlecenieProdukcyjne.update({
      where: { id },
      data: { status },
      include: {
        maszyna: true,
        zamowienie: {
          include: {
            klient: true,
            pozycje: {
              include: {
                produkt: {
                  include: {
                    grupa: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await zsynchronizujStatusZamowieniaPoZmianieZlecenia(zlecenie.zamowienieId);

    res.json({ sukces: true, dane: mapujZlecenieNaKanban(zlecenie) });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zaktualizowac statusu zlecenia.' });
  }
}

export async function pobierzPanelTabletowy(req: Request, res: Response): Promise<void> {
  try {
    const typ = String(req.query.typ ?? 'PRODUKCJA').toUpperCase();

    if (!czyTypPaneluTabletowego(typ)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Przekazano nieprawidlowy typ panelu.' });
      return;
    }

    const tylkoOperacjeKoncowe = typ === 'PAKOWANIE';

    const zlecenia: ZleceniePaneluPayload[] = await prisma.zlecenieProdukcyjne.findMany({
      where: {
        aktywne: true,
        status: { in: ['STOP', 'W_TOKU'] },
        OR: [{ planowanyStart: { not: null } }, { planowanyStop: { not: null } }],
        maszynaKoncowa: tylkoOperacjeKoncowe,
        maszyna: {
          aktywna: true,
        },
      },
      orderBy: [
        { maszyna: { kolejnosc: 'asc' } },
        { planowanyStart: 'asc' },
        { planowanyStop: 'asc' },
        { utworzonyW: 'asc' },
      ],
      include: {
        maszyna: {
          include: {
            panel: true,
          },
        },
        zamowienie: {
          include: {
            klient: true,
            pozycje: {
              include: {
                produkt: {
                  include: {
                    grupa: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const pracownicyIds = Array.from(
      new Set(zlecenia.flatMap((zlecenie) => zlecenie.przypisaniPracownicyIds))
    );

    const pracownicy = pracownicyIds.length
      ? await prisma.pracownik.findMany({
          where: { id: { in: pracownicyIds }, aktywny: true },
          select: {
            id: true,
            imie: true,
            nazwisko: true,
            kolorAvatara: true,
          },
          orderBy: [{ imie: 'asc' }, { nazwisko: 'asc' }],
        })
      : [];

    const pracownicyMapa = new Map(
      pracownicy.map((pracownik) => [
        pracownik.id,
        {
          id: pracownik.id,
          nazwa: formatujNazwePracownika(pracownik),
          inicjaly: `${pracownik.imie[0] ?? ''}${pracownik.nazwisko[0] ?? ''}`.toUpperCase(),
          kolorAvatara: pracownik.kolorAvatara,
        },
      ])
    );

    const grupyMap = new Map<
      number,
      {
        maszyna: {
          id: number;
          nazwa: string;
          panelId: number | null;
          panelNazwa: string | null;
          kolejnosc: number;
        };
        sumaPlan: number;
        sumaWykonana: number;
        sumaBrakow: number;
        zlecenia: Array<{
          id: number;
          numer: string;
          status: StatusZlecenia;
          iloscPlan: number;
          iloscWykonana: number;
          iloscBrakow: number;
          planowanyStart: string | null;
          planowanyStop: string | null;
          maszynaKoncowa: boolean;
          klient: { id: number; nazwa: string } | null;
          zamowienie: { id: number; idProdio: string; zewnetrznyNumer: string | null };
          produkt: {
            id: number;
            nazwa: string;
            grupa: { id: number; nazwa: string } | null;
            zdjecie: string | null;
          } | null;
          poprzednik: {
            id: number;
            numer: string;
            status: StatusZlecenia;
            iloscPlan: number;
            iloscWykonana: number;
          } | null;
          przypisaniPracownicy: Array<{
            id: number;
            nazwa: string;
            inicjaly: string;
            kolorAvatara: string;
          }>;
        }>;
      }
    >();

    for (const zlecenie of zlecenia) {
      const produkt = pobierzProduktZeZlecenia(zlecenie.zamowienie);

      let poprzednik: {
        id: number;
        numer: string;
        status: StatusZlecenia;
        iloscPlan: number;
        iloscWykonana: number;
      } | null = null;

      if (zlecenie.poprzednikId) {
        const poprzednikZlecenia = await prisma.zlecenieProdukcyjne.findUnique({
          where: { id: zlecenie.poprzednikId },
          select: {
            id: true,
            numer: true,
            status: true,
            iloscPlan: true,
            iloscWykonana: true,
          },
        });

        poprzednik = poprzednikZlecenia ?? null;
      }

      if (!grupyMap.has(zlecenie.maszyna.id)) {
        grupyMap.set(zlecenie.maszyna.id, {
          maszyna: {
            id: zlecenie.maszyna.id,
            nazwa: zlecenie.maszyna.nazwa,
            panelId: zlecenie.maszyna.panelId ?? null,
            panelNazwa: zlecenie.maszyna.panel?.nazwa ?? null,
            kolejnosc: zlecenie.maszyna.kolejnosc,
          },
          sumaPlan: 0,
          sumaWykonana: 0,
          sumaBrakow: 0,
          zlecenia: [],
        });
      }

      const grupa = grupyMap.get(zlecenie.maszyna.id);
      if (!grupa) continue;

      grupa.sumaPlan += zlecenie.iloscPlan;
      grupa.sumaWykonana += zlecenie.iloscWykonana;
      grupa.sumaBrakow += zlecenie.iloscBrakow;
      grupa.zlecenia.push({
        id: zlecenie.id,
        numer: zlecenie.numer,
        status: zlecenie.status,
        iloscPlan: zlecenie.iloscPlan,
        iloscWykonana: zlecenie.iloscWykonana,
        iloscBrakow: zlecenie.iloscBrakow,
        planowanyStart: zlecenie.planowanyStart ? zlecenie.planowanyStart.toISOString() : null,
        planowanyStop: zlecenie.planowanyStop ? zlecenie.planowanyStop.toISOString() : null,
        maszynaKoncowa: zlecenie.maszynaKoncowa,
        klient: zlecenie.zamowienie.klient
          ? {
              id: zlecenie.zamowienie.klient.id,
              nazwa: zlecenie.zamowienie.klient.nazwa,
            }
          : null,
        zamowienie: {
          id: zlecenie.zamowienie.id,
          idProdio: zlecenie.zamowienie.idProdio,
          zewnetrznyNumer: zlecenie.zamowienie.zewnetrznyNumer,
        },
        produkt: produkt
          ? {
              id: produkt.id,
              nazwa: produkt.nazwa,
              grupa: produkt.grupa ? { id: produkt.grupa.id, nazwa: produkt.grupa.nazwa } : null,
              zdjecie: produkt.zdjecie,
            }
          : null,
        poprzednik,
        przypisaniPracownicy: zlecenie.przypisaniPracownicyIds
          .map((pracownikId) => pracownicyMapa.get(pracownikId))
          .filter(
            (
              pracownik
            ): pracownik is {
              id: number;
              nazwa: string;
              inicjaly: string;
              kolorAvatara: string;
            } => Boolean(pracownik)
          ),
      });
    }

    const grupy = Array.from(grupyMap.values()).sort(
      (a, b) => a.maszyna.kolejnosc - b.maszyna.kolejnosc || a.maszyna.id - b.maszyna.id
    );

    res.json({
      sukces: true,
      dane: {
        typ,
        grupy,
        podsumowanie: {
          liczbaMaszyn: grupy.length,
          liczbaZlecen: zlecenia.length,
          sumaPlan: grupy.reduce((suma, grupa) => suma + grupa.sumaPlan, 0),
          sumaWykonana: grupy.reduce((suma, grupa) => suma + grupa.sumaWykonana, 0),
        },
      },
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac danych panelu tabletowego.' });
  }
}

export async function pobierzPracownikowPaneluTabletowego(req: Request, res: Response): Promise<void> {
  try {
    const typ = String(req.query.typ ?? 'PAKOWANIE').toUpperCase();
    const szukaj = String(req.query.szukaj ?? '').trim();

    if (!czyTypPaneluTabletowego(typ)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Przekazano nieprawidlowy typ panelu.' });
      return;
    }

    const pracownicy = await prisma.pracownik.findMany({
      where: {
        aktywny: true,
        ...(szukaj
          ? {
              OR: [
                { imie: { contains: szukaj, mode: 'insensitive' } },
                { nazwisko: { contains: szukaj, mode: 'insensitive' } },
                { stanowisko: { contains: szukaj, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        imie: true,
        nazwisko: true,
        stanowisko: true,
        kolorAvatara: true,
        pin: true,
      },
      orderBy: [{ imie: 'asc' }, { nazwisko: 'asc' }],
    });

    res.json({
      sukces: true,
      dane: pracownicy.map((pracownik) => ({
        id: pracownik.id,
        imie: pracownik.imie,
        nazwisko: pracownik.nazwisko,
        nazwa: formatujNazwePracownika(pracownik),
        stanowisko: pracownik.stanowisko ?? (typ === 'PAKOWANIE' ? 'Pakowanie' : 'Produkcja'),
        inicjaly: `${pracownik.imie[0] ?? ''}${pracownik.nazwisko[0] ?? ''}`.toUpperCase(),
        kolorAvatara: pracownik.kolorAvatara,
        wymagaPin: Boolean(pracownik.pin),
      })),
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac pracownikow panelu tabletowego.' });
  }
}

export async function pobierzZleceniePaneluTabletowego(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);

    if (!Number.isFinite(id)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowy identyfikator zlecenia.' });
      return;
    }

    const zlecenie = await prisma.zlecenieProdukcyjne.findUnique({
      where: { id },
      include: {
        maszyna: {
          include: {
            panel: true,
          },
        },
        zamowienie: {
          include: {
            klient: true,
            pozycje: {
              include: {
                produkt: {
                  include: {
                    grupa: true,
                    bomSurowcow: {
                      include: {
                        surowiec: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        historiaWydajnosci: {
          orderBy: [{ czasStart: 'desc' }],
          select: {
            id: true,
            pracownikId: true,
            czasStart: true,
            czasStop: true,
            iloscWykonana: true,
            iloscBrakow: true,
          },
        },
      },
    });

    if (!zlecenie) {
      res.status(404).json({ sukces: false, wiadomosc: 'Zlecenie nie istnieje.' });
      return;
    }

    const produkt = pobierzProduktZeZlecenia(zlecenie.zamowienie);
    const produktZBomem = zlecenie.zamowienie.pozycje[0]?.produkt ?? null;
    const czasPracySekundy = zlecenie.historiaWydajnosci.reduce(
      (suma, wpis) => suma + roznicaSekund(wpis.czasStart, wpis.czasStop),
      0
    );
    const historiaPracownikowIds = Array.from(
      new Set(
        zlecenie.historiaWydajnosci
          .map((wpis) => wpis.pracownikId)
          .filter((pracownikId): pracownikId is number => Number.isFinite(pracownikId))
      )
    );
    const historiaWykonaniaPracownicy = await pobierzPracownikowDlaHistorii(historiaPracownikowIds);

    res.json({
      sukces: true,
      dane: {
        id: zlecenie.id,
        numer: zlecenie.numer,
        status: zlecenie.status,
        iloscPlan: zlecenie.iloscPlan,
        iloscWykonana: zlecenie.iloscWykonana,
        iloscBrakow: zlecenie.iloscBrakow,
        planowanyStart: zlecenie.planowanyStart ? zlecenie.planowanyStart.toISOString() : null,
        planowanyStop: zlecenie.planowanyStop ? zlecenie.planowanyStop.toISOString() : null,
        utworzonyW: zlecenie.utworzonyW.toISOString(),
        maszyna: {
          id: zlecenie.maszyna.id,
          nazwa: zlecenie.maszyna.nazwa,
          panelNazwa: zlecenie.maszyna.panel?.nazwa ?? null,
        },
        klient: zlecenie.zamowienie.klient
          ? {
              id: zlecenie.zamowienie.klient.id,
              nazwa: zlecenie.zamowienie.klient.nazwa,
            }
          : null,
        zamowienie: {
          id: zlecenie.zamowienie.id,
          idProdio: zlecenie.zamowienie.idProdio,
          zewnetrznyNumer: zlecenie.zamowienie.zewnetrznyNumer,
          oczekiwanaData: zlecenie.zamowienie.oczekiwanaData ? zlecenie.zamowienie.oczekiwanaData.toISOString() : null,
        },
        produkt: produkt
          ? {
              id: produkt.id,
              nazwa: produkt.nazwa,
              grupa: produkt.grupa ? { id: produkt.grupa.id, nazwa: produkt.grupa.nazwa } : null,
              zdjecie: produkt.zdjecie,
            }
          : null,
        przypisaniPracownicy: await pobierzPracownikowDlaHistorii(zlecenie.przypisaniPracownicyIds),
        historiaWykonaniaPracownicy,
        surowce: (produktZBomem?.bomSurowcow ?? []).map((pozycja) => ({
          id: pozycja.id,
          nazwa: pozycja.surowiec.nazwa,
          jednostka: pozycja.surowiec.jednostka,
          iloscNaSztuke: Number(pozycja.ilosc),
          iloscPlan: Number(pozycja.ilosc) * zlecenie.iloscPlan,
        })),
        czasPracySekundy,
      },
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac zlecenia panelu tabletowego.' });
  }
}

export async function wykonajAkcjeZleceniaPaneluTabletowego(req: Request, res: Response): Promise<void> {
  try {
    const zlecenieId = parseInt(req.params.id, 10);
    const pracownikId = parseIntValue(req.body.pracownikId);
    const pin = String(req.body.pin ?? '').trim();
    const akcja = String(req.body.akcja ?? '').trim().toUpperCase() as 'START' | 'PAUZA' | 'STOP';

    if (!Number.isFinite(zlecenieId) || !pracownikId || !['START', 'PAUZA', 'STOP'].includes(akcja)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe dane meldunku.' });
      return;
    }

    const [pracownik, zlecenie, aktywnaRejestracja, aktywnaPauza, aktywneZleceniaPracownika, aktywneWpisyDoZamkniecia] = await Promise.all([
      prisma.pracownik.findUnique({
        where: { id: pracownikId },
        select: { id: true, aktywny: true, pin: true, stawkaGodzinowa: true },
      }),
      prisma.zlecenieProdukcyjne.findUnique({
        where: { id: zlecenieId },
        select: {
          id: true,
          aktywne: true,
          status: true,
          przypisaniPracownicyIds: true,
          maszyna: { select: { kosztRbh: true } },
        },
      }),
      prisma.rejestraCzasPracy.findFirst({
        where: { pracownikId, wyjscie: null },
        orderBy: [{ wejscie: 'desc' }],
      }),
      prisma.pauza.findFirst({
        where: { pracownikId, czasStop: null },
        orderBy: [{ czasStart: 'desc' }],
      }),
      prisma.zlecenieProdukcyjne.findMany({
        where: {
          aktywne: true,
          status: { in: ['W_TOKU', 'PAUZA'] },
          przypisaniPracownicyIds: { has: pracownikId },
          id: { not: zlecenieId },
        },
        select: {
          id: true,
          przypisaniPracownicyIds: true,
        },
      }),
      prisma.historiaWydajnosci.findMany({
        where: {
          pracownikId,
          czasStop: null,
          zlecenie: { aktywne: true, status: { in: ['W_TOKU', 'PAUZA'] }, id: { not: zlecenieId } },
        },
        select: {
          id: true,
          czasStart: true,
          zlecenie: { select: { maszyna: { select: { kosztRbh: true } } } },
        },
      }),
    ]);

    if (!pracownik?.aktywny) {
      res.status(404).json({ sukces: false, wiadomosc: 'Pracownik nie istnieje lub jest nieaktywny.' });
      return;
    }

    if (!zlecenie?.aktywne) {
      res.status(404).json({ sukces: false, wiadomosc: 'Zlecenie nie istnieje lub jest nieaktywne.' });
      return;
    }

    if (pracownik.pin && pracownik.pin !== pin) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowy PIN pracownika.' });
      return;
    }

    if (akcja === 'PAUZA' && !aktywnaRejestracja) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nie mozna uruchomic pauzy bez rozpoczecia pracy.' });
      return;
    }

    const teraz = new Date();
    const przypiszDoZlecenia = zlecenie.przypisaniPracownicyIds.includes(pracownikId)
      ? zlecenie.przypisaniPracownicyIds
      : [...zlecenie.przypisaniPracownicyIds, pracownikId];
    const aktywnyWpisHistorii = await prisma.historiaWydajnosci.findFirst({
      where: {
        zlecenieId,
        pracownikId,
        czasStop: null,
      },
      orderBy: [{ czasStart: 'desc' }],
      select: { id: true, czasStart: true },
    });

    if (akcja === 'START') {
      await prisma.$transaction([
        ...(!aktywnaRejestracja
          ? [prisma.rejestraCzasPracy.create({ data: { pracownikId, wejscie: teraz, wejscieWyglad: teraz } })]
          : []),
        ...(aktywnaPauza
          ? [prisma.pauza.update({ where: { id: aktywnaPauza.id }, data: { czasStop: teraz } })]
          : []),
        ...(!aktywnyWpisHistorii
          ? [
              prisma.historiaWydajnosci.create({
                data: {
                  zlecenieId,
                  pracownikId,
                  czasStart: teraz,
                },
              }),
            ]
          : []),
        ...aktywneZleceniaPracownika.map((inneZlecenie) =>
          prisma.zlecenieProdukcyjne.update({
            where: { id: inneZlecenie.id },
            data: {
              przypisaniPracownicyIds: {
                set: bezPracownika(inneZlecenie.przypisaniPracownicyIds, pracownikId),
              },
            },
          })
        ),
        ...aktywneWpisyDoZamkniecia.map((wpis) =>
          prisma.historiaWydajnosci.update({
            where: { id: wpis.id },
            data: {
              czasStop: teraz,
              ...obliczKosztyWpisu(wpis.czasStart, teraz, wpis.zlecenie.maszyna?.kosztRbh, pracownik?.stawkaGodzinowa),
            },
          })
        ),
        prisma.zlecenieProdukcyjne.update({
          where: { id: zlecenieId },
          data: {
            przypisaniPracownicyIds: {
              set: przypiszDoZlecenia,
            },
            status: 'W_TOKU',
          },
        }),
      ]);
    }

    if (akcja === 'PAUZA') {
      await prisma.$transaction([
        ...(!aktywnaPauza
          ? [
              prisma.pauza.create({
                data: {
                  pracownikId,
                  czasStart: teraz,
                  typPauzy: 'PRZERWA_REGULAMINOWA',
                },
              }),
            ]
          : []),
        ...(aktywnyWpisHistorii
          ? [
              prisma.historiaWydajnosci.update({
                where: { id: aktywnyWpisHistorii.id },
                data: {
                  czasStop: teraz,
                  ...obliczKosztyWpisu(aktywnyWpisHistorii.czasStart, teraz, zlecenie?.maszyna?.kosztRbh, pracownik?.stawkaGodzinowa),
                },
              }),
            ]
          : []),
        prisma.zlecenieProdukcyjne.update({
          where: { id: zlecenieId },
          data: {
            przypisaniPracownicyIds: {
              set: przypiszDoZlecenia,
            },
            status: 'PAUZA',
          },
        }),
      ]);
    }

    if (akcja === 'STOP') {
      const pozostaliPracownicy = bezPracownika(zlecenie.przypisaniPracownicyIds, pracownikId);

      await prisma.$transaction([
        ...(aktywnaPauza
          ? [prisma.pauza.update({ where: { id: aktywnaPauza.id }, data: { czasStop: teraz } })]
          : []),
        ...(aktywnaRejestracja
          ? [prisma.rejestraCzasPracy.update({ where: { id: aktywnaRejestracja.id }, data: { wyjscie: teraz, wyjscieWyglad: teraz } })]
          : []),
        ...(aktywnyWpisHistorii
          ? [
              prisma.historiaWydajnosci.update({
                where: { id: aktywnyWpisHistorii.id },
                data: {
                  czasStop: teraz,
                  ...obliczKosztyWpisu(aktywnyWpisHistorii.czasStart, teraz, zlecenie?.maszyna?.kosztRbh, pracownik?.stawkaGodzinowa),
                },
              }),
            ]
          : []),
        prisma.zlecenieProdukcyjne.update({
          where: { id: zlecenieId },
          data: {
            przypisaniPracownicyIds: {
              set: pozostaliPracownicy,
            },
            status: pozostaliPracownicy.length > 0 ? 'W_TOKU' : 'STOP',
          },
        }),
      ]);
    }

    res.json({ sukces: true });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie wykonac akcji dla panelu tabletowego.' });
  }
}
