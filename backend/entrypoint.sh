#!/bin/sh
set -e

echo "Czekam na gotowość bazy danych..."
until npx prisma db push --schema=src/prisma/schema.prisma --accept-data-loss 2>/dev/null; do
  echo "Baza danych nie gotowa - ponawianie za 3s..."
  sleep 3
done

echo "Schemat zsynchronizowany."

echo "Uruchamianie seeda..."
./node_modules/.bin/ts-node src/prisma/seed.ts || echo "Seed pominięty (dane już istnieją lub błąd)."

echo "Uruchamianie serwera..."
exec npm run dev
