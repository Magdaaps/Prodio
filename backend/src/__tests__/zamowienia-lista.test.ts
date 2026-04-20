jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    zamowienie: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, idProdio: 'ZAM-001', klient: null, pozycje: [] }]),
      count: jest.fn().mockResolvedValue(3),
    },
  })),
}));

import { pobierzZamowienia, pobierzLiczbeZaleglychZamowien } from '../kontrolery/kontrolerZamowien';
import type { Request, Response } from 'express';

const mockRes = () => {
  const r = { json: jest.fn(), status: jest.fn() } as unknown as Response;
  (r.status as jest.Mock).mockReturnValue(r);
  return r;
};
const mockReq = (overrides = {}) => ({ query: {}, params: {}, body: {}, ...overrides } as unknown as Request);

describe('pobierzZamowienia', () => {
  it('zwraca liste z paginacja', async () => {
    const res = mockRes();
    await pobierzZamowienia(mockReq(), res);
    const wynik = (res.json as jest.Mock).mock.calls[0][0];
    expect(wynik.sukces).toBe(true);
    expect(Array.isArray(wynik.dane)).toBe(true);
    expect(wynik).toHaveProperty('lacznie');
    expect(wynik).toHaveProperty('strona');
  });

  it('akceptuje parametry filtrowania', async () => {
    const res = mockRes();
    await pobierzZamowienia(mockReq({ query: { strona: '2', szukaj: 'test', status: 'NOWE' } }), res);
    expect((res.json as jest.Mock).mock.calls[0][0].sukces).toBe(true);
  });
});

describe('pobierzLiczbeZaleglychZamowien', () => {
  it('zwraca liczbe zaleglych jako liczbe', async () => {
    const res = mockRes();
    await pobierzLiczbeZaleglychZamowien(mockReq(), res);
    const wynik = (res.json as jest.Mock).mock.calls[0][0];
    expect(wynik.sukces).toBe(true);
    expect(wynik.dane).toHaveProperty('liczba');
    expect(typeof wynik.dane.liczba).toBe('number');
  });
});
