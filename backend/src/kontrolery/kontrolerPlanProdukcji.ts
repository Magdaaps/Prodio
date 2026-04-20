import { Request, Response } from 'express';
import { Prisma, PrismaClient, StatusZlecenia } from '@prisma/client';

const prisma = new PrismaClient();

const STATUSY_KANBAN = ['STOP', 'W_TOKU', 'PAUZA', 'GOTOWE'] as const satisfies readonly StatusZlecenia[];

type StatusKanban = (typeof STATUSY_KANBAN)[number];

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

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function czyStatusKanban(value: unknown): value is StatusKanban {
  return typeof value === 'string' && STATUSY_KANBAN.includes(value as StatusKanban);
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

    res.json({ sukces: true, dane: mapujZlecenieNaKanban(zlecenie) });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zaktualizowac statusu zlecenia.' });
  }
}
