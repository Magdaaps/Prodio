SELECT email, aktywny, haslo IS NOT NULL AS ma_haslo
FROM uzytkownicy
WHERE email = 'admin@prodio.pl';

SELECT COUNT(*) AS liczba_tokenow
FROM tokeny_odswiezania;
