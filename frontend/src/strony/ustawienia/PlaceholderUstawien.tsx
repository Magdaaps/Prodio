export default function PlaceholderUstawien({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className='space-y-6 text-slate-100'>
      <section className='rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6 shadow-2xl shadow-black/20'>
        <h1 className='text-3xl font-semibold'>{tytul}</h1>
        <p className='mt-2 max-w-3xl text-sm text-slate-400'>{opis}</p>
      </section>

      <section className='rounded-[28px] border border-dashed border-slate-700 bg-slate-900/60 px-6 py-16 text-center shadow-xl shadow-black/20'>
        <p className='text-lg font-medium text-slate-100'>W przygotowaniu</p>
        <p className='mt-2 text-sm text-slate-400'>Ta sekcja ma juz trase, wiec nawigacja pozostaje spojna podczas kolejnych sprintow.</p>
      </section>
    </div>
  );
}
