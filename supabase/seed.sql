-- Seed del catálogo Electravelin (idempotente).

insert into public.vehicles (id, modelo, marca, bateria_utilizable_kwh, consumo_referencia_kwh_100km, potencia_carga_maxima_kw, conectores, imagen_url, activo) values
  ('tesla_model3_lr', 'Tesla Model 3 Long Range', 'Tesla', 75, 14.5, 250, ARRAY['CCS2'], '/assets/tesla_model3.png', true),
  ('tesla_modely_lr', 'Tesla Model Y Long Range', 'Tesla', 75, 15.7, 250, ARRAY['CCS2'], '/assets/tesla_modely.png', true),
  ('byd_dolphin', 'BYD Dolphin', 'BYD', 44.9, 13, 60, ARRAY['CCS2'], '/assets/byd_dolphin.png', true),
  ('byd_seal', 'BYD Seal', 'BYD', 82.5, 15.2, 150, ARRAY['CCS2'], '/assets/byd_seal.png', true),
  ('byd_atto3', 'BYD Atto 3', 'BYD', 60.5, 15.6, 88, ARRAY['CCS2'], '/assets/byd_atto3.png', true),
  ('hyundai_kona_ev', 'Hyundai Kona Electric', 'Hyundai', 64, 14.7, 77, ARRAY['CCS2'], '/assets/hyundai_kona.png', true),
  ('hyundai_ioniq5', 'Hyundai Ioniq 5', 'Hyundai', 72.6, 16.8, 220, ARRAY['CCS2'], '/assets/hyundai_ioniq5.png', true),
  ('kia_ev6', 'Kia EV6', 'Kia', 77.4, 16.5, 240, ARRAY['CCS2'], '/assets/kia_ev6.png', true),
  ('nissan_leaf_eplus', 'Nissan Leaf e+', 'Nissan', 59, 17.1, 50, ARRAY['CHAdeMO'], '/assets/nissan_leaf.png', true),
  ('mg_zs_ev', 'MG ZS EV Long Range', 'MG', 50.3, 17, 76, ARRAY['CCS2'], '/assets/mg_zs.png', true),
  ('mg4_electric', 'MG4 Electric', 'MG', 51, 16.6, 117, ARRAY['CCS2'], '/assets/mg4.png', true),
  ('renault_megane_etech', 'Renault Mégane E-Tech', 'Renault', 60, 16.4, 130, ARRAY['CCS2'], '/assets/renault_megane.png', true),
  ('peugeot_e208', 'Peugeot e-208', 'Peugeot', 46.3, 15.3, 100, ARRAY['CCS2'], '/assets/peugeot_e208.png', true),
  ('citroen_ec4', 'Citroën ë-C4', 'Citroën', 50, 16.6, 100, ARRAY['CCS2'], '/assets/citroen_ec4.png', true),
  ('volvo_ex30', 'Volvo EX30', 'Volvo', 64, 17.2, 153, ARRAY['CCS2'], '/assets/volvo_ex30.png', true),
  ('bmw_ix1', 'BMW iX1', 'BMW', 64.7, 17.4, 130, ARRAY['CCS2'], '/assets/bmw_ix1.png', true),
  ('chevrolet_bolt_euv', 'Chevrolet Bolt EUV', 'Chevrolet', 65, 16.6, 55, ARRAY['CCS2'], '/assets/chevrolet_bolt.png', true),
  ('ford_mustang_mache', 'Ford Mustang Mach-E', 'Ford', 70, 17.5, 115, ARRAY['CCS2'], '/assets/ford_mache.png', true),
  ('audi_q4_etron', 'Audi Q4 e-tron', 'Audi', 77, 18, 135, ARRAY['CCS2'], '/assets/audi_q4.png', true)
on conflict (id) do update set modelo = excluded.modelo, marca = excluded.marca, bateria_utilizable_kwh = excluded.bateria_utilizable_kwh, consumo_referencia_kwh_100km = excluded.consumo_referencia_kwh_100km, potencia_carga_maxima_kw = excluded.potencia_carga_maxima_kw, conectores = excluded.conectores, imagen_url = excluded.imagen_url, activo = excluded.activo;

insert into public.stations (id, nombre, ciudad_id, ciudad, region, operador, latitud, longitud, conectores, potencia_maxima_kw, tarifa_clp_kwh, tipo_tarifa, disponible, verificada) values
  ('sta_santiago_copec', 'Copec Voltex Santiago Centro', 'santiago', 'Santiago', 'Región Metropolitana', 'Copec Voltex', -33.4489, -70.6693, ARRAY['CCS2', 'CHAdeMO'], 150, 250, 'CLP/kWh', true, true),
  ('sta_santiago_enelx', 'Enel X Way Santiago', 'santiago', 'Santiago', 'Región Metropolitana', 'Enel X Way', -33.4372, -70.6506, ARRAY['CCS2'], 50, 240, 'CLP/kWh', true, true),
  ('sta_rancagua_enex', 'ENEX e-drive Rancagua', 'rancagua', 'Rancagua', 'Región de O''Higgins', 'ENEX e-drive', -34.1701, -70.7394, ARRAY['CCS2'], 50, 280, 'CLP/kWh', true, true),
  ('sta_sanfernando_copec', 'Copec Voltex San Fernando', 'san_fernando', 'San Fernando', 'Región de O''Higgins', 'Copec Voltex', -34.5839, -71.0003, ARRAY['CCS2'], 100, 260, 'CLP/kWh', true, true),
  ('sta_curico_shell', 'Shell Recharge Curicó', 'curico', 'Curicó', 'Región del Maule', 'Shell Recharge', -34.9828, -71.2394, ARRAY['CCS2', 'CHAdeMO'], 100, 268, 'CLP/kWh', true, true),
  ('sta_talca_shell', 'Shell Recharge Talca', 'talca', 'Talca', 'Región del Maule', 'Shell Recharge', -35.4264, -71.6554, ARRAY['CCS2', 'CHAdeMO'], 150, 270, 'CLP/kWh', true, true),
  ('sta_linares_enex', 'ENEX e-drive Linares', 'linares', 'Linares', 'Región del Maule', 'ENEX e-drive', -35.8464, -71.593, ARRAY['CCS2'], 60, 285, 'CLP/kWh', true, true),
  ('sta_chillan_copec', 'Copec Voltex Chillán', 'chillan', 'Chillán', 'Región de Ñuble', 'Copec Voltex', -36.6066, -72.1034, ARRAY['CCS2'], 100, 255, 'CLP/kWh', true, true),
  ('sta_concepcion_copec', 'Copec Voltex Concepción', 'concepcion', 'Concepción', 'Región del Biobío', 'Copec Voltex', -36.8201, -73.0445, ARRAY['CCS2', 'CHAdeMO'], 150, 258, 'CLP/kWh', true, true),
  ('sta_losangeles_enex', 'ENEX e-drive Los Ángeles', 'los_angeles', 'Los Ángeles', 'Región del Biobío', 'ENEX e-drive', -37.4693, -72.3527, ARRAY['CCS2', 'CHAdeMO'], 60, 290, 'CLP/kWh', true, true),
  ('sta_temuco_copec', 'Copec Voltex Temuco', 'temuco', 'Temuco', 'Región de La Araucanía', 'Copec Voltex', -38.7359, -72.5904, ARRAY['CCS2'], 150, 265, 'CLP/kWh', true, true),
  ('sta_temuco_shell', 'Shell Recharge Temuco', 'temuco', 'Temuco', 'Región de La Araucanía', 'Shell Recharge', -38.7452, -72.6102, ARRAY['CCS2', 'CHAdeMO'], 100, 275, 'CLP/kWh', true, true),
  ('sta_villarrica_enex', 'ENEX e-drive Villarrica', 'villarrica', 'Villarrica', 'Región de La Araucanía', 'ENEX e-drive', -39.2856, -72.2274, ARRAY['CCS2'], 60, 292, 'CLP/kWh', true, true),
  ('sta_valdivia_shell', 'Shell Recharge Valdivia', 'valdivia', 'Valdivia', 'Región de Los Ríos', 'Shell Recharge', -39.8142, -73.2459, ARRAY['CCS2', 'CHAdeMO'], 100, 275, 'CLP/kWh', true, true),
  ('sta_osorno_copec', 'Copec Voltex Osorno', 'osorno', 'Osorno', 'Región de Los Lagos', 'Copec Voltex', -40.5739, -73.1336, ARRAY['CCS2'], 100, 272, 'CLP/kWh', true, true),
  ('sta_puertomontt_copec', 'Copec Voltex Puerto Montt', 'puerto_montt', 'Puerto Montt', 'Región de Los Lagos', 'Copec Voltex', -41.4693, -72.9424, ARRAY['CCS2'], 100, 270, 'CLP/kWh', true, true),
  ('sta_puertomontt_enelx', 'Enel X Way Puerto Montt', 'puerto_montt', 'Puerto Montt', 'Región de Los Lagos', 'Enel X Way', -41.4747, -72.9365, ARRAY['CCS2', 'CHAdeMO'], 50, 260, 'CLP/kWh', true, true)
on conflict (id) do update set nombre = excluded.nombre, ciudad_id = excluded.ciudad_id, ciudad = excluded.ciudad, region = excluded.region, operador = excluded.operador, latitud = excluded.latitud, longitud = excluded.longitud, conectores = excluded.conectores, potencia_maxima_kw = excluded.potencia_maxima_kw, tarifa_clp_kwh = excluded.tarifa_clp_kwh, tipo_tarifa = excluded.tipo_tarifa, disponible = excluded.disponible, verificada = excluded.verificada;
