const mockZam = { id: 1, idProdio: 'ZAM-001', klient: null, pozycje: [], zlecenia: [] };
const mockFindUnique = jest.fn().mockResolvedValue(mockZam);
const mockDelete = jest.fn().mockResolvedValue({ id: 1 });
const mockCreate = jest.fn().mockResolvedValue(mockZam);
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    zamowienie: { findUnique: mockFindUnique, delete: mockDelete, create: mockCreate },
  })),
}));
import { pobierzZamowienie, usunZamowienie, utworzZamowienie } from '../kontrolery/kontrolerZamowien';
import type { Request, Response } from 'express';
const mockRes = () => {
  const r = { json: jest.fn(), status: jest.fn() } as unknown as Response;
  (r.status as jest.Mock).mockReturnValue(r);
  return r;
};
const mockReq = (o = {}) => ({ query: {}, params: {}, body: {}, ...o } as unknown as Request);
beforeEach(() => {
  mockFindUnique.mockResolvedValue(mockZam);
  mockDelete.mockResolvedValue({ id: 1 });
  mockCreate.mockResolvedValue(mockZam);
  mockFindUnique.mockClear();
  mockDelete.mockClear();
  mockCreate.mockClear();
});
describe('utworzZamowienie', () => {
  it('generuje idProdio gdy nie zostalo podane', async () => {
    const res = mockRes();
    mockFindUnique.mockResolvedValue(null);

    await utworzZamowienie(
      mockReq({
        body: {
          zewnetrznyNumer: 'ZK/806/2026',
          pozycje: [{ produktId: 5, ilosc: 10 }],
        },
      }),
      res
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idProdio: expect.stringMatching(/^ZAM-\d{6}$/),
        }),
      })
    );
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(201);
  });
});
describe('pobierzZamowienie', () => {
  it('zwraca zamowienie gdy istnieje', async () => {
    const res = mockRes();
    await pobierzZamowienie(mockReq({ params: { id: '1' } }), res);
    const wynik = (res.json as jest.Mock).mock.calls[0][0];
    expect(wynik.sukces).toBe(true);
    expect(wynik.dane.idProdio).toBe('ZAM-001');
  });
  it('zwraca 404 gdy nie istnieje', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = mockRes();
    await pobierzZamowienie(mockReq({ params: { id: '999' } }), res);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });
});
describe('usunZamowienie', () => {
  it('usuwa gdy istnieje', async () => {
    const res = mockRes();
    await usunZamowienie(mockReq({ params: { id: '1' } }), res);
    expect((res.json as jest.Mock).mock.calls[0][0].sukces).toBe(true);
  });
  it('zwraca 404 gdy nie istnieje', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = mockRes();
    await usunZamowienie(mockReq({ params: { id: '999' } }), res);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });
});
