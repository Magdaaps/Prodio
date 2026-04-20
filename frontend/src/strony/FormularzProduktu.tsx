import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, FileUp, Trash2, ArrowUpDown } from 'lucide-react';
import klientApi from '../api/klient';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import Modal from '../komponenty/ui/Modal';

interface OperacjaApi {
  id: number; maszynaId: number; normaSztGodz: string | number;
  parametry: string | null; tagi: string[]; maszynaKoncowa: boolean; kolejnosc: number;
}
interface WierszOperacji {
  id?: number; tempId: string; maszynaId: number | null;
  normaSztGodz: string; parametry: string; tagi: string[]; maszynaKoncowa: boolean; kolejnosc: number;
}
interface SurowiecApi {
  id: number; nazwa: string; jednostka: string; cena: string | number; waluta: string; aktywny: boolean;
}
interface BomSurowcaApi {
  id: number; surowiecId: number; maszynaId: number | null; ilosc: string | number; jednostka: string;
  surowiec: { id: number; nazwa: string; jednostka: string; cena: string | number; waluta: string };
  maszyna: { id: number; nazwa: string } | null;
}
interface WierszSurowca {
  id?: number; tempId: string; surowiecId: number | null; maszynaId: number | null; ilosc: string; jednostka: string;
}

interface GrupaProduktu { id: number; nazwa: string; }
interface KlientProduktu { id: number; nazwa: string; }
interface OdpowiedzListy<T> { sukces: boolean; dane: T[]; }
interface OdpowiedzApi<T> { sukces: boolean; dane: T; }

interface FormularzProduktu {
  nazwa: string; idProdio: string; ean: string; dodatkoweOznaczenia: string;
  wymiar: string; sposobPakowania: string; informacjeNiewidoczne: string;
  informacjeWidoczne: string; cena: string; waluta: string; stawkaVat: string;
  grupaId: string; klientId: string; aktywny: boolean; zdjecie: string;
}

const domyslny: FormularzProduktu = {
  nazwa: '', idProdio: '', ean: '', dodatkoweOznaczenia: '', wymiar: '',
  sposobPakowania: '', informacjeNiewidoczne: '', informacjeWidoczne: '',
  cena: '', waluta: 'PLN', stawkaVat: '23', grupaId: '', klientId: '', aktywny: true, zdjecie: '',
};

type ZakladkaId = 'podstawowe' | 'technologia' | 'surowce';

const klasySelect = 'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none transition-colors';
const klasyTextarea = 'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none resize-y';

export default function FormularzProduktu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const trybEdycji = Boolean(id);
  const duplicateFromId =
    !trybEdycji &&
    typeof (location.state as { duplicateFromId?: unknown } | null)?.duplicateFromId === 'number'
      ? (location.state as { duplicateFromId: number }).duplicateFromId
      : null;
  const [form, ustawForm] = useState<FormularzProduktu>(domyslny);
  const [grupy, ustawGrupy] = useState<GrupaProduktu[]>([]);
  const [klienci, ustawKlienci] = useState<KlientProduktu[]>([]);
  const [zakladka, ustawZakladke] = useState<ZakladkaId>('podstawowe');
  const [blad, ustawBlad] = useState('');
  const [bledyPol, ustawBledyPol] = useState<Partial<Record<keyof FormularzProduktu, string>>>({});
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [ladowanie, ustawLadowanie] = useState(trybEdycji || Boolean(duplicateFromId));
  const zdjeciaRef = useRef<File[]>([]);
  const plikiRef = useRef<File[]>([]);

  useEffect(() => {
    void pobierzSlowniki();
    if (trybEdycji && id) {
      void pobierzProdukt(parseInt(id));
      return;
    }

    if (duplicateFromId) {
      void pobierzProdukt(duplicateFromId, true);
      return;
    }

    ustawForm(domyslny);
    ustawLadowanie(false);
  }, [duplicateFromId, id, trybEdycji]);

  const pobierzSlowniki = async () => {
    const [rK, rG] = await Promise.allSettled([
      klientApi.get<OdpowiedzListy<KlientProduktu>>('/klienci', { params: { strona: 1, iloscNaStrone: 100, sortPole: 'nazwa', sortKierunek: 'asc' } }),
      klientApi.get<OdpowiedzApi<GrupaProduktu[]>>('/produkty/grupy'),
    ]);
    if (rK.status === 'fulfilled') ustawKlienci(rK.value.data.dane);
    if (rG.status === 'fulfilled') ustawGrupy(rG.value.data.dane);
  };

  const pobierzProdukt = async (pid: number, czyDuplikat = false) => {
    ustawLadowanie(true);
    try {
      const r = await klientApi.get<OdpowiedzApi<Record<string, unknown>>>(`/produkty/${pid}`);
      const d = r.data.dane;
      ustawForm({
        nazwa: String(d.nazwa ?? ''), idProdio: czyDuplikat ? '' : String(d.idProdio ?? ''),
        ean: String(d.ean ?? ''), dodatkoweOznaczenia: String(d.dodatkoweOznaczenia ?? ''),
        wymiar: String(d.wymiar ?? ''), sposobPakowania: String(d.sposobPakowania ?? ''),
        informacjeNiewidoczne: String(d.informacjeNiewidoczne ?? ''),
        informacjeWidoczne: String(d.informacjeWidoczne ?? ''),
        cena: d.cena != null ? String(d.cena) : '', waluta: String(d.waluta ?? 'PLN'),
        stawkaVat: String(d.stawkaVat ?? '23'),
        grupaId: d.grupaId != null ? String(d.grupaId) : '',
        klientId: d.klientId != null ? String(d.klientId) : '',
        aktywny: Boolean(d.aktywny),
        zdjecie: d.zdjecie != null ? String(d.zdjecie) : '',
      });
    } catch { /* ignoruj blad pobierania */ }
    finally { ustawLadowanie(false); }
  };

  const setPole = <K extends keyof FormularzProduktu>(pole: K, v: FormularzProduktu[K]) => {
    ustawForm(p => ({ ...p, [pole]: v }));
    ustawBledyPol(p => ({ ...p, [pole]: undefined }));
  };

  const waliduj = () => {
    const b: Partial<Record<keyof FormularzProduktu, string>> = {};
    if (!form.nazwa.trim()) b.nazwa = 'Nazwa produktu jest wymagana.';
    if (!form.idProdio.trim()) b.idProdio = 'ID Prodio jest wymagane.';
    ustawBledyPol(b);
    return Object.keys(b).length === 0;
  };

  const zapisz = async (zostac: boolean) => {
    if (!waliduj()) { ustawBlad('Uzupelnij wymagane pola.'); return; }
    ustawZapisywanie(true); ustawBlad('');
    const payload = {
      idProdio: form.idProdio.trim(), nazwa: form.nazwa.trim(),
      ean: form.ean.trim() || undefined, dodatkoweOznaczenia: form.dodatkoweOznaczenia.trim() || undefined,
      wymiar: form.wymiar.trim() || undefined, sposobPakowania: form.sposobPakowania.trim() || undefined,
      informacjeNiewidoczne: form.informacjeNiewidoczne.trim() || undefined,
      informacjeWidoczne: form.informacjeWidoczne.trim() || undefined,
      cena: form.cena.trim() || undefined, waluta: form.waluta || 'PLN',
      stawkaVat: form.stawkaVat || '23', grupaId: form.grupaId || undefined,
      klientId: form.klientId || undefined, aktywny: form.aktywny,
      zdjecie: form.zdjecie || undefined,
    };
    try {
      if (trybEdycji && id) {
        await klientApi.put(`/produkty/${id}`, payload);
        if (!zostac) navigate('/produkty');
      } else {
        const r = await klientApi.post<OdpowiedzApi<{ id: number }>>('/produkty', payload);
        if (zostac) navigate(`/produkty/${r.data.dane.id}/edytuj`);
        else navigate('/produkty');
      }
    } catch { ustawBlad(trybEdycji ? 'Nie udalo sie zapisac zmian.' : 'Nie udalo sie utworzyc produktu.'); }
    finally { ustawZapisywanie(false); }
  };

  if (ladowanie) {
    return <div className='flex items-center justify-center py-24 text-tekst-drugorzedny text-sm'>Ladowanie danych produktu...</div>;
  }

  const zakladki: { id: ZakladkaId; etykieta: string; ikona: string }[] = [
    { id: 'podstawowe', etykieta: 'PODSTAWOWE INFORMACJE (OPCJONALNIE)', ikona: '📋' },
    { id: 'technologia', etykieta: 'TECHNOLOGIA PRODUKCJI (OPCJONALNIE)', ikona: '⚙️' },
    { id: 'surowce', etykieta: 'SUROWCE (OPCJONALNIE)', ikona: '🧪' },
  ];

  return (
    <div>
      <div className='rounded-2xl border border-obramowanie bg-tlo-karta shadow-sm'>
        {!trybEdycji && duplicateFromId ? (
          <div className='border-b border-obramowanie bg-akcent/10 px-6 py-3 text-sm text-akcent'>
            Tryb duplikacji: dane zostaly skopiowane z istniejacego produktu. Wpisz nowe `ID Prodio`, a potem zapisz kopie.
          </div>
        ) : null}
        <div className='flex flex-col gap-4 px-6 py-4 border-b border-obramowanie sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3 flex-1 min-w-0'>
            <label className='text-base font-semibold text-tekst-glowny whitespace-nowrap'>Nazwa produktu :</label>
            <input
              type='text' placeholder='Wpisz tutaj nazwe produktu' value={form.nazwa}
              onChange={e => setPole('nazwa', e.target.value)}
              className={`flex-1 min-w-0 bg-transparent border-b-2 pb-1 text-tekst-glowny text-base placeholder-tekst-drugorzedny focus:outline-none transition-colors ${bledyPol.nazwa ? "border-red-500" : "border-obramowanie focus:border-akcent"}`}
            />
          </div>
          <div className='flex items-center gap-4 shrink-0'>
            <span className='text-sm text-tekst-drugorzedny'>Aktywne :</span>
            <Przelacznik wartosc={form.aktywny} onZmiana={v => setPole('aktywny', v)} />
            <Przycisk wariant='drugorzedny' onClick={() => navigate('/produkty')}><ArrowLeft size={16} />Wróc</Przycisk>
          </div>
        </div>

        <div className='flex border-b border-obramowanie px-6 overflow-x-auto'>
          {zakladki.map(z => (
            <button key={z.id} type='button' onClick={() => ustawZakladke(z.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${zakladka === z.id ? "border-akcent text-akcent" : "border-transparent text-tekst-drugorzedny hover:text-tekst-glowny"}`}>
              {z.ikona} {z.etykieta}
            </button>
          ))}
        </div>

        <div className='p-6'>
          {blad && <div className='mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{blad}</div>}
          {zakladka === 'podstawowe' && <ZakladkaPodstawowe form={form} grupy={grupy} klienci={klienci} bledyPol={bledyPol} setPole={setPole} zdjeciaRef={zdjeciaRef} plikiRef={plikiRef} onGrupaDodana={pobierzSlowniki} />}
          {zakladka === 'technologia' && (trybEdycji && id
            ? <ZakladkaTechnologia produktId={parseInt(id)} />
            : <div className='flex items-center justify-center py-24 text-tekst-drugorzedny text-sm'>Technologia produkcji zostanie skonfigurowana po zapisaniu produktu.</div>
          )}
          {zakladka === 'surowce' && (trybEdycji && id
            ? <ZakladkaSurowce produktId={parseInt(id)} />
            : <div className='flex items-center justify-center py-24 text-tekst-drugorzedny text-sm'>Surowce zostana skonfigurowane po zapisaniu produktu.</div>
          )}
        </div>

        <div className='flex items-center gap-3 px-6 py-4 border-t border-obramowanie'>
          <Przycisk type='button' wariant='drugorzedny' czyLaduje={zapisywanie} onClick={() => void zapisz(true)}>Zapisz i zostań</Przycisk>
          <Przycisk type='button' czyLaduje={zapisywanie} onClick={() => void zapisz(false)}>Zapisz</Przycisk>
        </div>
      </div>
    </div>
  );
}

interface PropsZakladki {
  form: FormularzProduktu; grupy: GrupaProduktu[]; klienci: KlientProduktu[];
  bledyPol: Partial<Record<keyof FormularzProduktu, string>>;
  setPole: <K extends keyof FormularzProduktu>(pole: K, v: FormularzProduktu[K]) => void;
  zdjeciaRef: React.MutableRefObject<File[]>; plikiRef: React.MutableRefObject<File[]>;
  onGrupaDodana: () => Promise<void>;
}

function ZakladkaPodstawowe({ form, grupy, klienci, bledyPol, setPole, zdjeciaRef, plikiRef, onGrupaDodana }: PropsZakladki) {
  const [zdjeciaPreview, ustawZdjeciaPreview] = useState<string[]>([]);
  const [plikiNazwy, ustawPlikiNazwy] = useState<string[]>([]);
  const [dragZdj, ustawDragZdj] = useState(false);
  const [dragPlik, ustawDragPlik] = useState(false);
  const inputZdj = useRef<HTMLInputElement>(null);
  const inputPlik = useRef<HTMLInputElement>(null);
  const [modalGrupyOtwarty, ustawModalGrupyOtwarty] = useState(false);
  const [nowaGrupaNazwa, ustawNowaGrupaNazwa] = useState('');
  const [zapiszGrupe, ustawZapiszGrupe] = useState(false);
  const [modalPokazGrupyOtwarty, ustawModalPokazGrupyOtwarty] = useState(false);
  const [sortNazwa, ustawSortNazwa] = useState<'asc' | 'desc'>('asc');

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const dodajZdjecia = async (files: FileList | null) => {
    if (!files) return;
    const nowe = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (nowe.length === 0) return;
    zdjeciaRef.current = [...zdjeciaRef.current, ...nowe];
    nowe.forEach(f => ustawZdjeciaPreview(p => [...p, URL.createObjectURL(f)]));
    const base64 = await fileToBase64(nowe[0]);
    setPole('zdjecie', base64 as never);
  };

  const dodajPliki = (files: FileList | null) => {
    if (!files) return;
    const nowe = Array.from(files);
    plikiRef.current = [...plikiRef.current, ...nowe];
    ustawPlikiNazwy(p => [...p, ...nowe.map(f => f.name)]);
  };

  const usunGrupe = async (id: number) => {
    try {
      await klientApi.delete(`/grupy-produktow/${id}`);
      await onGrupaDodana();
    } catch { /* ignore */ }
  };

  const grupySortowane = [...grupy].sort((a, b) =>
    sortNazwa === 'asc' ? a.nazwa.localeCompare(b.nazwa) : b.nazwa.localeCompare(a.nazwa)
  );

  const zapiszNowaGrupe = async () => {
    if (!nowaGrupaNazwa.trim()) return;
    ustawZapiszGrupe(true);
    try {
      await klientApi.post('/grupy-produktow', { nazwa: nowaGrupaNazwa.trim() });
      ustawNowaGrupaNazwa('');
      ustawModalGrupyOtwarty(false);
      await onGrupaDodana();
    } catch { /* ignore */ }
    finally { ustawZapiszGrupe(false); }
  };

  return (
    <>
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]'>
      <div className='space-y-5'>
        <div>
          <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Grupa produktow</label>
          <div className='flex flex-wrap gap-2'>
            <select value={form.grupaId} onChange={e => setPole('grupaId', e.target.value)} className='flex-1 min-w-[160px] rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none'>
              <option value=''>Domyslna grupa</option>
              {grupy.map(g => <option key={g.id} value={g.id}>{g.nazwa}</option>)}
            </select>
            <button type='button' onClick={() => ustawModalGrupyOtwarty(true)} className='rounded-lg bg-akcent px-4 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors whitespace-nowrap'>Dodaj grupe produktow</button>
            <button type='button' onClick={() => ustawModalPokazGrupyOtwarty(true)} className='rounded-lg border border-obramowanie bg-tlo-karta px-4 py-2 text-sm font-medium text-tekst-glowny hover:bg-obramowanie transition-colors whitespace-nowrap'>Pokaz grupy</button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Klient</label>
            <div className='flex gap-2'>
              <select value={form.klientId} onChange={e => setPole('klientId', e.target.value)} className='flex-1 rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none'>
                <option value=''>Wybierz klienta</option>
                {klienci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
              </select>
              <button type='button' className='rounded-lg bg-akcent px-3 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors whitespace-nowrap'>Dodaj nowego</button>
            </div>
          </div>
          <Pole etykieta='EAN' value={form.ean} onChange={e => setPole('ean', e.target.value)} />
          <Pole etykieta='Dodatkowe oznaczenia' value={form.dodatkoweOznaczenia} onChange={e => setPole('dodatkoweOznaczenia', e.target.value)} bladOpisu={bledyPol.dodatkoweOznaczenia} />
          <Pole etykieta='Wymiar' value={form.wymiar} onChange={e => setPole('wymiar', e.target.value)} />
        </div>

        <Pole etykieta='Sposob pakowania' value={form.sposobPakowania} onChange={e => setPole('sposobPakowania', e.target.value)} />

        <div>
          <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Dodatkowe informacje do produktu (niewidoczne dla produkcji)</label>
          <textarea rows={4} value={form.informacjeNiewidoczne} onChange={e => setPole('informacjeNiewidoczne', e.target.value)} className={klasyTextarea} />
        </div>
        <div>
          <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Dodatkowe informacje do produktu (widoczne dla produkcji)</label>
          <textarea rows={4} value={form.informacjeWidoczne} onChange={e => setPole('informacjeWidoczne', e.target.value)} className={klasyTextarea} />
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <Pole etykieta='Cena' type='number' min='0' step='0.01' value={form.cena} onChange={e => setPole('cena', e.target.value)} />
          <div>
            <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Waluty</label>
            <select value={form.waluta} onChange={e => setPole('waluta', e.target.value)} className={klasySelect}>
              <option value='PLN'>PLN</option><option value='EUR'>EUR</option><option value='USD'>USD</option><option value='GBP'>GBP</option>
            </select>
          </div>
          <div>
            <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Stawka VAT</label>
            <select value={form.stawkaVat} onChange={e => setPole('stawkaVat', e.target.value)} className={klasySelect}>
              <option value='0'>0%</option><option value='5'>5%</option><option value='8'>8%</option><option value='23'>23%</option>
            </select>
          </div>
        </div>

        <Pole etykieta='ID Prodio' value={form.idProdio} onChange={e => setPole('idProdio', e.target.value)} bladOpisu={bledyPol.idProdio} required />
      </div>

      <div className='space-y-3'>
        <div onDragOver={e => { e.preventDefault(); ustawDragZdj(true); }} onDragLeave={() => ustawDragZdj(false)}
          onDrop={e => { e.preventDefault(); ustawDragZdj(false); void dodajZdjecia(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed min-h-[200px] flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${dragZdj ? "border-akcent bg-akcent/5" : "border-obramowanie bg-tlo-glowne/40"}`}
          onClick={() => inputZdj.current?.click()}>
          {zdjeciaPreview.length > 0
            ? <div className='grid grid-cols-2 gap-2 p-3 w-full'>{zdjeciaPreview.map((url, i) => <img key={i} src={url} alt='' className='w-full h-24 object-contain rounded-lg' />)}</div>
            : form.zdjecie
            ? <div className='p-3 w-full'><img src={form.zdjecie} alt='Zdjecie produktu' className='w-full h-40 object-contain rounded-lg' /></div>
            : <p className='text-tekst-drugorzedny text-sm'>Przeciagnij i upusc pliki tutaj ...</p>}
        </div>
        <div className='flex gap-2'>
          <input ref={inputZdj} type='file' accept='image/*' multiple className='hidden' onChange={e => void dodajZdjecia(e.target.files)} />
          <input type='text' readOnly placeholder='Wybierz pliki ...' onClick={() => inputZdj.current?.click()}
            className='flex-1 rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-drugorzedny cursor-pointer focus:outline-none' />
          <button type='button' onClick={() => inputZdj.current?.click()}
            className='flex items-center gap-2 rounded-lg bg-akcent px-3 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors whitespace-nowrap'>
            <ImagePlus size={14} />Dodaj zdjecia
          </button>
        </div>

        <div onDragOver={e => { e.preventDefault(); ustawDragPlik(true); }} onDragLeave={() => ustawDragPlik(false)}
          onDrop={e => { e.preventDefault(); ustawDragPlik(false); dodajPliki(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed min-h-[160px] flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${dragPlik ? "border-akcent bg-akcent/5" : "border-obramowanie bg-tlo-glowne/40"}`}
          onClick={() => inputPlik.current?.click()}>
          {plikiNazwy.length > 0
            ? <ul className='p-3 w-full space-y-1'>{plikiNazwy.map((n, i) => <li key={i} className='text-xs text-tekst-glowny truncate'>{n}</li>)}</ul>
            : <p className='text-tekst-drugorzedny text-sm'>Przeciagnij i upusc pliki tutaj ...</p>}
        </div>
        <div className='flex gap-2'>
          <input ref={inputPlik} type='file' multiple className='hidden' onChange={e => dodajPliki(e.target.files)} />
          <input type='text' readOnly placeholder='Wybierz pliki ...' onClick={() => inputPlik.current?.click()}
            className='flex-1 rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-drugorzedny cursor-pointer focus:outline-none' />
          <button type='button' onClick={() => inputPlik.current?.click()}
            className='flex items-center gap-2 rounded-lg bg-akcent px-3 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors whitespace-nowrap'>
            <FileUp size={14} />Dodaj pliki
          </button>
        </div>

      </div>
    </div>
    <Modal
      czyOtwarty={modalGrupyOtwarty}
      onZamknij={() => { ustawModalGrupyOtwarty(false); ustawNowaGrupaNazwa(''); }}
      tytul='Utwórz grupę'
      rozmiar='maly'
      akcje={
        <button
          type='button'
          onClick={() => void zapiszNowaGrupe()}
          disabled={zapiszGrupe || !nowaGrupaNazwa.trim()}
          className='rounded-lg bg-akcent px-4 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors disabled:opacity-50'
        >
          Zapisz
        </button>
      }
    >
      <input
        type='text'
        value={nowaGrupaNazwa}
        onChange={e => ustawNowaGrupaNazwa(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void zapiszNowaGrupe(); }}
        autoFocus
        className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none transition-colors'
        placeholder='Nazwa grupy'
      />
    </Modal>
    <Modal czyOtwarty={modalPokazGrupyOtwarty} onZamknij={() => ustawModalPokazGrupyOtwarty(false)} tytul='Grupy produktów' rozmiar='sredni'>
      <p className='mb-3 text-sm text-tekst-drugorzedny'>Showing <strong>1-{grupy.length}</strong> of <strong>{grupy.length}</strong> items.</p>
      <table className='w-full text-sm'>
        <thead><tr className='border-b border-obramowanie'>
          <th className='py-2 pr-4 text-left font-semibold text-tekst-glowny w-10'>#</th>
          <th className='py-2 text-left font-semibold text-tekst-glowny'>
            <button type='button' onClick={() => ustawSortNazwa(s => s === 'asc' ? 'desc' : 'asc')} className='flex items-center gap-1 hover:text-akcent transition-colors'>
              Nazwa <ArrowUpDown size={13} />
            </button>
          </th>
          <th className='py-2 w-10' />
        </tr></thead>
        <tbody>
          {grupySortowane.map((g, i) => (
            <tr key={g.id} className='border-b border-obramowanie/50 hover:bg-tlo-glowne/40'>
              <td className='py-2 pr-4 text-tekst-drugorzedny'>{i + 1}</td>
              <td className='py-2'>
                <button type='button' onClick={() => { setPole('grupaId', String(g.id) as never); ustawModalPokazGrupyOtwarty(false); }} className='text-blue-400 underline hover:text-blue-300 text-left'>
                  {g.nazwa}
                </button>
              </td>
              <td className='py-2 text-right'>
                {g.nazwa !== 'Domyslna grupa' && g.nazwa !== 'Domyślna grupa' && (
                  <button type='button' onClick={() => void usunGrupe(g.id)} className='text-tekst-drugorzedny hover:text-red-400 transition-colors'>
                    <Trash2 size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
    </>
  );
}

function ZakladkaTechnologia({ produktId }: { produktId: number }) {
  const [wiersze, ustawWiersze] = useState<WierszOperacji[]>([]);
  const [maszyny, ustawMaszyny] = useState<{ id: number; nazwa: string }[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [nowyTag, ustawNowyTag] = useState<Record<string, string>>({});
  const wierszRef = useRef<WierszOperacji[]>([]);
  useEffect(() => { wierszRef.current = wiersze; }, [wiersze]);

  useEffect(() => { void pobierzDane(); }, []);

  const pobierzDane = async () => {
    ustawLadowanie(true);
    try {
      const [rM, rO] = await Promise.all([
        klientApi.get<{ sukces: boolean; dane: { id: number; nazwa: string }[] }>('/maszyny', { params: { strona: 1, iloscNaStrone: 100 } }),
        klientApi.get<{ sukces: boolean; dane: OperacjaApi[] }>(`/produkty/${produktId}/operacje`),
      ]);
      ustawMaszyny(rM.data.dane);
      ustawWiersze(rO.data.dane.map(o => ({
        id: o.id, tempId: String(o.id), maszynaId: o.maszynaId,
        normaSztGodz: String(o.normaSztGodz), parametry: o.parametry ?? '',
        tagi: o.tagi, maszynaKoncowa: o.maszynaKoncowa, kolejnosc: o.kolejnosc,
      })));
    } catch { /* ignore */ }
    finally { ustawLadowanie(false); }
  };

  const nowyTempId = () => `t${Date.now()}${Math.random().toString(36).slice(2)}`;

  const dodajWiersz = (poIdx?: number) => {
    const nowy: WierszOperacji = { tempId: nowyTempId(), maszynaId: null, normaSztGodz: '', parametry: '', tagi: [], maszynaKoncowa: false, kolejnosc: wiersze.length };
    if (poIdx !== undefined) {
      ustawWiersze(w => [...w.slice(0, poIdx + 1), nowy, ...w.slice(poIdx + 1)]);
    } else {
      ustawWiersze(w => [...w, nowy]);
    }
  };

  const usunWiersz = async (wiersz: WierszOperacji) => {
    try {
      if (wiersz.id) await klientApi.delete(`/produkty/${produktId}/operacje/${wiersz.id}`);
      ustawWiersze(w => w.filter(r => r.tempId !== wiersz.tempId));
    } catch { /* ignore */ }
  };

  const zapiszWiersz = async (wiersz: WierszOperacji) => {
    if (!wiersz.maszynaId) return;
    const payload = {
      maszynaId: wiersz.maszynaId,
      normaSztGodz: wiersz.normaSztGodz || '0',
      parametry: wiersz.parametry || undefined,
      tagi: wiersz.tagi,
      maszynaKoncowa: wiersz.maszynaKoncowa,
      kolejnosc: wiersz.kolejnosc,
    };
    try {
      if (wiersz.id) {
        await klientApi.put(`/produkty/${produktId}/operacje/${wiersz.id}`, payload);
      } else {
        const r = await klientApi.post<{ sukces: boolean; dane: { id: number } }>(`/produkty/${produktId}/operacje`, payload);
        ustawWiersze(w => w.map(row => row.tempId === wiersz.tempId ? { ...row, id: r.data.dane.id } : row));
      }
    } catch { /* ignore */ }
  };

  const zapiszPoTempId = async (tempId: string) => {
    const w = wierszRef.current.find(r => r.tempId === tempId);
    if (w) await zapiszWiersz(w);
  };

  const setWiersz = (tempId: string, zmiany: Partial<WierszOperacji>) => {
    ustawWiersze(w => w.map(r => r.tempId === tempId ? { ...r, ...zmiany } : r));
  };

  const zmienMaszyne = async (tempId: string, maszynaId: number | null) => {
    const wiersz = wierszRef.current.find(w => w.tempId === tempId);
    if (!wiersz) return;
    const zaktualizowany = { ...wiersz, maszynaId };
    ustawWiersze(w => w.map(r => r.tempId === tempId ? zaktualizowany : r));
    if (!maszynaId) return;
    await zapiszWiersz(zaktualizowany);
  };

  const dodajTag = (tempId: string) => {
    const tag = (nowyTag[tempId] ?? '').trim();
    if (!tag) return;
    const wiersz = wierszRef.current.find(w => w.tempId === tempId);
    if (!wiersz || wiersz.tagi.includes(tag)) return;
    const zaktualizowany = { ...wiersz, tagi: [...wiersz.tagi, tag] };
    ustawWiersze(w => w.map(r => r.tempId === tempId ? zaktualizowany : r));
    ustawNowyTag(t => ({ ...t, [tempId]: '' }));
    void zapiszWiersz(zaktualizowany);
  };

  const usunTag = (tempId: string, tag: string) => {
    const wiersz = wierszRef.current.find(w => w.tempId === tempId);
    if (!wiersz) return;
    const zaktualizowany = { ...wiersz, tagi: wiersz.tagi.filter(t => t !== tag) };
    ustawWiersze(w => w.map(r => r.tempId === tempId ? zaktualizowany : r));
    void zapiszWiersz(zaktualizowany);
  };

  if (ladowanie) return <div className='flex items-center justify-center py-16 text-tekst-drugorzedny text-sm'>Ładowanie...</div>;

  return (
    <div>
      <p className='mb-4 text-sm text-tekst-drugorzedny'>Tu możesz rozpisać kolejność wykonywania produktu na poszczególnych maszynach/operacjach</p>
      <button type='button' onClick={() => dodajWiersz()}
        className='mb-6 flex items-center gap-2 rounded-lg bg-akcent px-4 py-2 text-sm font-medium text-white hover:bg-akcent-hover transition-colors'>
        + Dodaj na operację/maszynę
      </button>
      {wiersze.length > 0 && (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-obramowanie'>
                <th className='w-16' />
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Maszyna/ Operacja</th>
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>
                  Norma wykonania <span title='Ilość sztuk na godzinę' className='cursor-help text-tekst-drugorzedny inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-xs'>?</span>
                </th>
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Parametry operacji</th>
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Tagi</th>
                <th className='py-2 px-3 text-center font-semibold text-tekst-glowny'>
                  Maszyna końcowa <span title='Ostatnia operacja dla produktu' className='cursor-help text-tekst-drugorzedny inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-xs'>?</span>
                </th>
                <th className='w-28' />
              </tr>
            </thead>
            <tbody>{wiersze.map((w, idx) => <WierszTechnologii key={w.tempId} wiersz={w} idx={idx} maszyny={maszyny} nowyTag={nowyTag[w.tempId] ?? ''} onDodajWiersz={() => dodajWiersz(idx)} onUsun={() => void usunWiersz(w)} onZmienMaszyne={maszynaId => void zmienMaszyne(w.tempId, maszynaId)} onSetWiersz={zmiany => setWiersz(w.tempId, zmiany)} onZapisz={() => void zapiszPoTempId(w.tempId)} onDodajTag={() => dodajTag(w.tempId)} onUsunTag={tag => usunTag(w.tempId, tag)} onZmienTag={v => ustawNowyTag(t => ({ ...t, [w.tempId]: v }))} onZmienMaszyneKoncowa={checked => { const u = { ...w, maszynaKoncowa: checked }; setWiersz(w.tempId, { maszynaKoncowa: checked }); void zapiszWiersz(u); }} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface PropsWiersza {
  wiersz: WierszOperacji; idx: number; maszyny: { id: number; nazwa: string }[];
  nowyTag: string;
  onDodajWiersz: () => void; onUsun: () => void;
  onZmienMaszyne: (id: number | null) => void;
  onSetWiersz: (z: Partial<WierszOperacji>) => void;
  onZapisz: () => void;
  onDodajTag: () => void; onUsunTag: (t: string) => void; onZmienTag: (v: string) => void;
  onZmienMaszyneKoncowa: (c: boolean) => void;
}

function WierszTechnologii({ wiersz: w, maszyny, nowyTag, onDodajWiersz, onUsun, onZmienMaszyne, onSetWiersz, onZapisz, onDodajTag, onUsunTag, onZmienTag, onZmienMaszyneKoncowa }: PropsWiersza) {
  const klasyInput = 'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-glowny focus:border-akcent focus:outline-none';
  return (
    <tr className='border-b border-obramowanie/40 align-top'>
      <td className='py-3 pr-2'>
        <div className='flex flex-col gap-1 items-center pt-1'>
          <button type='button' onClick={onDodajWiersz} className='flex h-6 w-6 items-center justify-center rounded border border-obramowanie text-tekst-drugorzedny hover:bg-tlo-glowne text-xs font-bold'>+</button>
          <button type='button' onClick={onUsun} className='flex h-6 w-6 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 text-sm font-bold'>−</button>
        </div>
      </td>
      <td className='py-3 px-3 min-w-[200px]'>
        <div className='flex items-center gap-1 mb-1'>
          <select value={w.maszynaId ?? ''} onChange={e => onZmienMaszyne(e.target.value ? parseInt(e.target.value) : null)} className={klasyInput}>
            <option value=''>Wybierz maszynę</option>
            {maszyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
          </select>
          {w.maszynaId && <button type='button' onClick={() => onZmienMaszyne(null)} className='text-red-400 hover:text-red-300 text-lg leading-none px-1'>×</button>}
        </div>
      </td>
      <td className='py-3 px-3 min-w-[180px]'>
        <input type='number' min='0' step='0.01' value={w.normaSztGodz} onChange={e => onSetWiersz({ normaSztGodz: e.target.value })} onBlur={onZapisz} className={`${klasyInput} mb-1`} />
        <select className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-1.5 text-xs text-tekst-drugorzedny focus:border-akcent focus:outline-none'>
          <option value='szt_godz'>Ilość produktów/godz.</option>
        </select>
      </td>
      <td className='py-3 px-3 min-w-[180px]'>
        <textarea value={w.parametry} onChange={e => onSetWiersz({ parametry: e.target.value })} onBlur={onZapisz} rows={3} className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-glowny focus:border-akcent focus:outline-none resize-y' />
      </td>
      <td className='py-3 px-3 min-w-[150px]'>
        <div className='flex flex-wrap gap-1 mb-2'>
          {w.tagi.map(t => (
            <span key={t} className='flex items-center gap-1 rounded bg-akcent/20 px-2 py-0.5 text-xs text-akcent'>
              {t}<button type='button' onClick={() => onUsunTag(t)} className='text-tekst-drugorzedny hover:text-red-400 leading-none'>×</button>
            </span>
          ))}
        </div>
        <div className='flex gap-1'>
          <input type='text' placeholder='Dodaj tag' value={nowyTag}
            onChange={e => onZmienTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onDodajTag(); } }}
            className='flex-1 rounded-lg border border-obramowanie bg-tlo-glowne px-2 py-1 text-xs text-tekst-glowny focus:border-akcent focus:outline-none' />
          <button type='button' onClick={onDodajTag} className='rounded-lg border border-obramowanie bg-tlo-glowne px-2 py-1 text-xs text-tekst-drugorzedny hover:bg-obramowanie'>Dodaj</button>
        </div>
      </td>
      <td className='py-3 px-3 text-center'>
        <input type='checkbox' checked={w.maszynaKoncowa} onChange={e => onZmienMaszyneKoncowa(e.target.checked)} className='h-5 w-5 cursor-pointer accent-akcent' />
      </td>
      <td className='py-3 px-3'>
        <button type='button' className='rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-1.5 text-xs text-tekst-glowny hover:bg-obramowanie transition-colors whitespace-nowrap'>Dodaj pliki</button>
      </td>
    </tr>
  );
}

function ZakladkaSurowce({ produktId }: { produktId: number }) {
  const [wiersze, ustawWiersze] = useState<WierszSurowca[]>([]);
  const [surowce, ustawSurowce] = useState<SurowiecApi[]>([]);
  const [maszyny, ustawMaszyny] = useState<{ id: number; nazwa: string }[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const wierszeRef = useRef<WierszSurowca[]>([]);

  useEffect(() => { wierszeRef.current = wiersze; }, [wiersze]);
  useEffect(() => { void pobierzDane(); }, [produktId]);

  const pobierzDane = async () => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      const [surowceRes, maszynyRes, bomRes] = await Promise.all([
        klientApi.get<{ sukces: boolean; dane: SurowiecApi[] }>('/surowce', { params: { strona: 1, iloscNaStrone: 500, sortPole: 'nazwa', sortKierunek: 'asc' } }),
        klientApi.get<{ sukces: boolean; dane: { id: number; nazwa: string }[] }>('/maszyny', { params: { strona: 1, iloscNaStrone: 200 } }),
        klientApi.get<{ sukces: boolean; dane: BomSurowcaApi[] }>(`/produkty/${produktId}/surowce`),
      ]);
      ustawSurowce(surowceRes.data.dane ?? []);
      ustawMaszyny(maszynyRes.data.dane ?? []);
      ustawWiersze((bomRes.data.dane ?? []).map((rekord) => ({
        id: rekord.id,
        tempId: String(rekord.id),
        surowiecId: rekord.surowiecId,
        maszynaId: rekord.maszynaId,
        ilosc: String(rekord.ilosc ?? ''),
        jednostka: rekord.jednostka || rekord.surowiec?.jednostka || 'szt',
      })));
    } catch {
      ustawWiersze([]);
    } finally {
      ustawLadowanie(false);
    }
  };

  const nowyTempId = () => `s${Date.now()}${Math.random().toString(36).slice(2)}`;

  const dodajWiersz = (poIdx?: number) => {
    const nowy: WierszSurowca = { tempId: nowyTempId(), surowiecId: null, maszynaId: null, ilosc: '', jednostka: 'szt' };
    ustawWiersze((poprzednie) => poIdx !== undefined
      ? [...poprzednie.slice(0, poIdx + 1), nowy, ...poprzednie.slice(poIdx + 1)]
      : [...poprzednie, nowy]);
  };

  const ustawWiersz = (tempId: string, zmiany: Partial<WierszSurowca>) => {
    ustawWiersze((poprzednie) => poprzednie.map((wiersz) => wiersz.tempId === tempId ? { ...wiersz, ...zmiany } : wiersz));
  };

  const zapiszWiersz = async (wiersz: WierszSurowca) => {
    if (!wiersz.surowiecId || !(Number(wiersz.ilosc) > 0)) return;
    const wybranySurowiec = surowce.find((surowiec) => surowiec.id === wiersz.surowiecId);
    const payload = {
      surowiecId: wiersz.surowiecId,
      maszynaId: wiersz.maszynaId ?? undefined,
      ilosc: Number(wiersz.ilosc),
      jednostka: wiersz.jednostka || wybranySurowiec?.jednostka || 'szt',
    };
    try {
      if (wiersz.id) {
        await klientApi.put(`/produkty/${produktId}/surowce/${wiersz.id}`, payload);
      } else {
        const odpowiedz = await klientApi.post<{ sukces: boolean; dane: BomSurowcaApi }>(`/produkty/${produktId}/surowce`, payload);
        ustawWiersze((poprzednie) => poprzednie.map((rekord) => rekord.tempId === wiersz.tempId ? { ...rekord, id: odpowiedz.data.dane.id, tempId: String(odpowiedz.data.dane.id) } : rekord));
      }
      ustawBlad('');
    } catch {
      ustawBlad('Nie udalo sie zapisac surowca produktu.');
    }
  };

  const zapiszPoTempId = async (tempId: string) => {
    const wiersz = wierszeRef.current.find((rekord) => rekord.tempId === tempId);
    if (wiersz) await zapiszWiersz(wiersz);
  };

  const zmienSurowiec = async (tempId: string, surowiecId: number | null) => {
    const surowiec = surowce.find((rekord) => rekord.id === surowiecId);
    const aktualny = wierszeRef.current.find((rekord) => rekord.tempId === tempId);
    if (!aktualny) return;
    const zaktualizowany = { ...aktualny, surowiecId, jednostka: surowiec?.jednostka || aktualny.jednostka || 'szt' };
    ustawWiersze((poprzednie) => poprzednie.map((rekord) => rekord.tempId === tempId ? zaktualizowany : rekord));
    if (zaktualizowany.id && zaktualizowany.surowiecId) await zapiszWiersz(zaktualizowany);
  };

  const zmienMaszyne = async (tempId: string, maszynaId: number | null) => {
    const aktualny = wierszeRef.current.find((rekord) => rekord.tempId === tempId);
    if (!aktualny) return;
    const zaktualizowany = { ...aktualny, maszynaId };
    ustawWiersze((poprzednie) => poprzednie.map((rekord) => rekord.tempId === tempId ? zaktualizowany : rekord));
    if (zaktualizowany.id) await zapiszWiersz(zaktualizowany);
  };

  const usunWiersz = async (wiersz: WierszSurowca) => {
    try {
      if (wiersz.id) await klientApi.delete(`/produkty/${produktId}/surowce/${wiersz.id}`);
      ustawWiersze((poprzednie) => poprzednie.filter((rekord) => rekord.tempId !== wiersz.tempId));
      ustawBlad('');
    } catch {
      ustawBlad('Nie udalo sie usunac surowca produktu.');
    }
  };

  if (ladowanie) return <div className='flex items-center justify-center py-16 text-tekst-drugorzedny text-sm'>Ladowanie...</div>;

  return (
    <div>
      <p className='mb-4 text-sm text-tekst-drugorzedny'>Przypisz surowce, z ktorych wytwarzany jest ten produkt.</p>
      <div className='mb-6 flex flex-wrap gap-3'>
        <Przycisk type='button' onClick={() => { window.location.href = '/magazyn/stany-magazynowe'; }}>Utworz nowy surowiec</Przycisk>
        <Przycisk type='button' wariant='drugorzedny' onClick={() => dodajWiersz()}>Przypisz surowiec</Przycisk>
      </div>
      {blad && <div className='mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{blad}</div>}
      {wiersze.length === 0 ? (
        <div className='rounded-xl border border-dashed border-obramowanie bg-tlo-glowne/30 px-4 py-10 text-center text-sm text-tekst-drugorzedny'>Brak przypisanych surowcow. Uzyj przycisku "Przypisz surowiec", aby dodac pierwsza pozycje.</div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-obramowanie'>
                <th className='w-16' />
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Surowiec</th>
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Ilosc na produkt</th>
                <th className='py-2 px-3 text-left font-semibold text-tekst-glowny'>Maszyna/ Operacja</th>
              </tr>
            </thead>
            <tbody>
              {wiersze.map((wiersz, idx) => (
                <WierszSurowca
                  key={wiersz.tempId}
                  wiersz={wiersz}
                  idx={idx}
                  surowce={surowce}
                  maszyny={maszyny}
                  onDodajWiersz={() => dodajWiersz(idx)}
                  onUsun={() => void usunWiersz(wiersz)}
                  onZmienSurowiec={(surowiecId) => void zmienSurowiec(wiersz.tempId, surowiecId)}
                  onZmienMaszyne={(maszynaId) => void zmienMaszyne(wiersz.tempId, maszynaId)}
                  onSetWiersz={(zmiany) => ustawWiersz(wiersz.tempId, zmiany)}
                  onZapisz={() => void zapiszPoTempId(wiersz.tempId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface PropsWierszaSurowca {
  wiersz: WierszSurowca; idx: number; surowce: SurowiecApi[]; maszyny: { id: number; nazwa: string }[];
  onDodajWiersz: () => void; onUsun: () => void;
  onZmienSurowiec: (id: number | null) => void; onZmienMaszyne: (id: number | null) => void;
  onSetWiersz: (zmiany: Partial<WierszSurowca>) => void; onZapisz: () => void;
}

function WierszSurowca({ wiersz, surowce, maszyny, onDodajWiersz, onUsun, onZmienSurowiec, onZmienMaszyne, onSetWiersz, onZapisz }: PropsWierszaSurowca) {
  const wybranySurowiec = surowce.find((surowiec) => surowiec.id === wiersz.surowiecId);
  const klasyInput = 'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-glowny focus:border-akcent focus:outline-none';

  return (
    <tr className='border-b border-obramowanie/40 align-top'>
      <td className='py-3 pr-2'>
        <div className='flex flex-col gap-1 items-center pt-1'>
          <button type='button' onClick={onDodajWiersz} className='flex h-6 w-6 items-center justify-center rounded border border-obramowanie text-tekst-drugorzedny hover:bg-tlo-glowne text-xs font-bold'>+</button>
          <button type='button' onClick={onUsun} className='flex h-6 w-6 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 text-sm font-bold'>-</button>
        </div>
      </td>
      <td className='py-3 px-3 min-w-[320px]'>
        <div className='flex items-center gap-1 mb-1'>
          <select value={wiersz.surowiecId ?? ''} onChange={(e) => onZmienSurowiec(e.target.value ? parseInt(e.target.value) : null)} className={klasyInput}>
            <option value=''>Wybierz surowiec</option>
            {surowce.map((surowiec) => (
              <option key={surowiec.id} value={surowiec.id}>
                {`${surowiec.nazwa} | ${surowiec.jednostka} | ${String(surowiec.cena)} ${surowiec.waluta}`}
              </option>
            ))}
          </select>
          {wiersz.surowiecId && <button type='button' onClick={() => onZmienSurowiec(null)} className='text-red-400 hover:text-red-300 text-lg leading-none px-1'>x</button>}
        </div>
        {wybranySurowiec && (
          <p className='text-xs text-tekst-drugorzedny'>Jednostka: <span className='text-tekst-glowny'>{wybranySurowiec.jednostka}</span> | Cena: <span className='text-tekst-glowny'>{String(wybranySurowiec.cena)} {wybranySurowiec.waluta}</span></p>
        )}
      </td>
      <td className='py-3 px-3 min-w-[220px]'>
        <div className='grid grid-cols-[1fr_92px] gap-2'>
          <input
            type='number'
            min='0'
            step='0.0001'
            value={wiersz.ilosc}
            onChange={(e) => onSetWiersz({ ilosc: e.target.value })}
            onBlur={onZapisz}
            className={klasyInput}
          />
          <input value={wiersz.jednostka} readOnly className={`${klasyInput} text-tekst-drugorzedny`} />
        </div>
      </td>
      <td className='py-3 px-3 min-w-[240px]'>
        <select value={wiersz.maszynaId ?? ''} onChange={(e) => onZmienMaszyne(e.target.value ? parseInt(e.target.value) : null)} className={klasyInput}>
          <option value=''>Bez przypisania</option>
          {maszyny.map((maszyna) => <option key={maszyna.id} value={maszyna.id}>{maszyna.nazwa}</option>)}
        </select>
      </td>
    </tr>
  );
}
