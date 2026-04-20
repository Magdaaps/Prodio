import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function glownaSeed() {
  console.log('Uruchamianie seeda bazy danych...');

  const zahashowaneHaslo = await bcrypt.hash('Admin1234!', 12);

  const admin = await prisma.uzytkownik.upsert({
    where: { email: 'admin@prodio.pl' },
    update: {},
    create: {
      email: 'admin@prodio.pl',
      haslo: zahashowaneHaslo,
      imie: 'Admin',
      nazwisko: 'Prodio',
      rola: 'ADMIN',
      aktywny: true
    }
  });

  console.log('Utworzono administratora:', admin.email);
  console.log('Seed zakończony pomyślnie.');
}

glownaSeed()
  .catch((blad) => {
    console.error('Błąd podczas seedowania:', blad);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
