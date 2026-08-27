-- Migration to expand police stations coverage across Greater Chennai & Tamil Nadu
INSERT INTO public.police_stations (name, lat, lng)
SELECT name, lat, lng FROM (VALUES
  -- North Chennai
  ('H1 Tondiarpet Police Station', 13.1284, 80.2882),
  ('N2 Kasimedu Police Station', 13.1250, 80.2970),
  ('H3 Washermanpet Police Station', 13.1118, 80.2812),
  ('N1 Royapuram Police Station', 13.1098, 80.2945),
  ('H4 Korukkupet Police Station', 13.1200, 80.2750),
  ('B1 North Beach / Harbour Police Station', 13.0945, 80.2920),
  ('B2 Flower Bazaar Police Station', 13.0910, 80.2840),
  ('C1 Elephant Gate Police Station', 13.0895, 80.2780),
  ('M1 Tiruvottiyur Police Station', 13.1610, 80.3010),
  ('M2 Madhavaram Police Station', 13.1480, 80.2310),
  ('K1 Sembium Police Station', 13.1140, 80.2390),
  ('K2 Perambur Police Station', 13.1090, 80.2450),
  ('M4 Vyasarpadi Police Station', 13.1040, 80.2610),
  ('P1 Pulianthope Police Station', 13.0960, 80.2630),
  ('P2 Otteri Police Station', 13.0920, 80.2520),

  -- Central Chennai
  ('G1 Vepery Police Station', 13.0850, 80.2670),
  ('Chennai Central Railway Police Station', 13.0827, 80.2755),
  ('F1 Chintadripet Police Station', 13.0760, 80.2730),
  ('F2 Egmore Police Station', 13.0780, 80.2600),
  ('D1 Triplicane Police Station', 13.0592, 80.2741),
  ('D6 Anna Square / Marina Beach Police Station', 13.0645, 80.2825),
  ('E2 Royapettah Police Station', 13.0566, 80.2612),
  ('E1 Mylapore Police Station', 13.0337, 80.2678),
  ('E3 Abhiramapuram / Alwarpet Police Station', 13.0360, 80.2520),
  ('G3 Kilpauk Police Station', 13.0790, 80.2430),
  ('G2 Chetpet Police Station', 13.0710, 80.2410),
  ('F3 Nungambakkam Police Station', 13.0580, 80.2430),
  ('D2 Thousand Lights Police Station', 13.0585, 80.2530),
  ('K4 Anna Nagar Police Station', 13.0850, 80.2180),
  ('V5 Thirumangalam Police Station', 13.0840, 80.1980),
  ('V1 Villivakkam Police Station', 13.1070, 80.2080),
  ('V6 Kolathur Police Station', 13.1230, 80.2140),

  -- South Chennai
  ('R1 Mambalam (T. Nagar) Police Station', 13.0418, 80.2337),
  ('J1 Saidapet Police Station', 13.0210, 80.2230),
  ('J3 Guindy Police Station', 13.0067, 80.2120),
  ('J2 Adyar Police Station', 13.0060, 80.2570),
  ('J5 Shastri Nagar / Besant Nagar Police Station', 12.9980, 80.2660),
  ('J6 Thiruvanmiyur Police Station', 12.9860, 80.2610),
  ('J7 Velachery Police Station', 12.9810, 80.2210),
  ('J4 Kotturpuram Police Station', 13.0180, 80.2430),
  ('J8 Taramani Police Station', 12.9770, 80.2440),
  ('J9 Neelankarai Police Station (ECR)', 12.9490, 80.2570),
  ('J10 Semmancheri / Sholinganallur Police Station (OMR)', 12.8710, 80.2280),

  -- West Chennai & Suburbs
  ('K10 Koyambedu Police Station', 13.0690, 80.1940),
  ('R8 Vadapalani Police Station', 13.0510, 80.2120),
  ('R3 Ashok Nagar Police Station', 13.0360, 80.2130),
  ('R4 KK Nagar Police Station', 13.0410, 80.1990),
  ('R5 Virugambakkam Police Station', 13.0515, 80.1910),
  ('R6 Valasaravakkam Police Station', 13.0430, 80.1760),
  ('SR1 Porur Police Station', 13.0380, 80.1560),
  ('T1 Ambattur Police Station', 13.1140, 80.1540),
  ('T2 Avadi Police Station', 13.1160, 80.1010),
  ('T4 Poonamallee Police Station', 13.0490, 80.0980),
  ('M3 Red Hills Police Station', 13.1980, 80.1970),
  ('S1 St. Thomas Mount Police Station', 13.0030, 80.1980),
  ('S3 Pallavaram Police Station', 12.9680, 80.1500),
  ('S4 Chromepet Police Station', 12.9510, 80.1410),
  ('S5 Tambaram Police Station', 12.9240, 80.1170),
  ('S7 Medavakkam Police Station', 12.9180, 80.1930)
) AS new_stations(name, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM public.police_stations ps
  WHERE ps.name = new_stations.name
);
