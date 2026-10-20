#!/usr/bin/env python3
"""
MAVEN FREIGHT OS - Russian Logistics Data Pipeline & Enrichment Engine
======================================================================
Author: Senior Logistics Data Engineer
Database: logistics_ru.db (Российская Федерация)

This script:
1. Defines 6 major Russian confectionery plants with precise GPS coordinates:
   - "Красный Октябрь" (Москва) [55.7420, 37.6080]
   - "Славянка" (Старый Оскол) [51.2970, 37.8340]
   - "КДВ Групп / Яшкино" (Кемерово / Яшкино) [55.8740, 85.4260]
   - "Кондитерская фабрика им. Самойловой" (Санкт-Петербург) [59.9070, 30.3440]
   - "Россия — щедрая душа" (Самара) [53.2100, 50.1900]
   - "Победа Вкуса" (Коломна/Егорьевск, МО) [55.3830, 39.0330]
2. Houses a database of 85+ key Russian cities with GPS coordinates and populations.
3. Synthesizes 10,250 realistic nationwide freight shipments across Russia:
   - Distances in kilometers (km) via Haversine + road winding factor (1.18x)
   - Rates in rubles (65 - 115 ₽/км)
   - Fuel cost: Diesel 64 ₽/л, Platon federal toll 3.05 ₽/км
   - Vehicle types: Рефрижератор 86м³ (+15°C), Еврофура 20т Тент 90м³, Изотермический фургон 15т, Газель Next 3т
   - Major Russian carriers: Деловые Линии, ПЭК, Монополия, Globaltruck, Байкал Сервис, КИТ, Возовоз, СДЭК Cargo
   - Certified Russian CDL drivers with SKZI tachograph numbers and state license plates
   - Realistic operational statuses: Доставлен, В пути, Погрузка на РЦ, Запланирован
4. Generates an optimized SQLite database "logistics_ru.db" in WAL mode with B-tree query indexes.
"""

import os
import sys
import math
import json
import sqlite3
import random
from datetime import datetime, timedelta
from collections import defaultdict, Counter

random.seed(108)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "logistics_ru.db")

# 6 Major Russian Confectionery Factories
FACTORIES_RU = [
    {
        "name": "Красный Октябрь",
        "lat": 55.7420,
        "lng": 37.6080,
        "city": "Москва",
        "state": "г. Москва",
        "region_fed": "Центральный ФО",
        "hub_code": "MOW-HUB-01",
        "capacity_pallets": 3500,
        "products": [
            ("КО-01", "Шоколад «Алёнка» 100г", "Шоколадные изделия", 115.0, 52.0),
            ("КО-02", "Конфеты «Красная Шапочка»", "Конфеты весовые", 720.0, 340.0),
            ("КО-03", "Конфеты «Мишка косолапый»", "Шоколадные изделия", 850.0, 410.0),
            ("КО-04", "Суфле «Коровка» сливочное", "Конфеты весовые", 430.0, 195.0),
            ("КО-05", "Трюфели «Экстра» элитные", "Шоколадные изделия", 980.0, 480.0),
        ]
    },
    {
        "name": "Славянка",
        "lat": 51.2970,
        "lng": 37.8340,
        "city": "Старый Оскол",
        "state": "Белгородская область",
        "region_fed": "Центральный ФО",
        "hub_code": "STO-HUB-02",
        "capacity_pallets": 3200,
        "products": [
            ("СЛ-01", "Конфеты «Золотой Степ» с арахисом", "Шоколадные изделия", 540.0, 245.0),
            ("СЛ-02", "Конфеты «Левушка» желейные", "Мармелад и желе", 380.0, 160.0),
            ("СЛ-03", "Конфеты «Чудо-Белочка»", "Шоколадные изделия", 620.0, 280.0),
            ("СЛ-04", "Десерт «Птичья сласть»", "Суфле и десерты", 490.0, 215.0),
        ]
    },
    {
        "name": "КДВ Групп / Яшкино",
        "lat": 55.8740,
        "lng": 85.4260,
        "city": "Яшкино",
        "state": "Кемеровская область",
        "region_fed": "Сибирский ФО",
        "hub_code": "KEM-HUB-03",
        "capacity_pallets": 4800,
        "products": [
            ("КДВ-01", "Вафли «Яшкино» с варёной сгущёнкой", "Вафли и печенье", 85.0, 36.0),
            ("КДВ-02", "Грильяж «Крокант» с миндалем", "Шоколадные изделия", 460.0, 190.0),
            ("КДВ-03", "Конфеты «Чио Рио»", "Шоколадные изделия", 520.0, 230.0),
            ("КДВ-04", "Батончик «Ярче!» арахис в карамели", "Батончики", 45.0, 18.0),
        ]
    },
    {
        "name": "Кондитерская фабрика им. Самойловой",
        "lat": 59.9070,
        "lng": 30.3440,
        "city": "Санкт-Петербург",
        "state": "г. Санкт-Петербург",
        "region_fed": "Северо-Западный ФО",
        "hub_code": "LED-HUB-04",
        "capacity_pallets": 2800,
        "products": [
            ("СФ-01", "Зефир в шоколаде «Самойловский»", "Пастила и зефир", 260.0, 115.0),
            ("СФ-02", "Грильяж в шоколадной глазури", "Шоколадные изделия", 690.0, 310.0),
            ("СФ-03", "Мармелад «Желейный ассорти»", "Мармелад и желе", 210.0, 88.0),
        ]
    },
    {
        "name": "Россия — щедрая душа",
        "lat": 53.2100,
        "lng": 50.1900,
        "city": "Самара",
        "state": "Самарская область",
        "region_fed": "Приволжский ФО",
        "hub_code": "KUF-HUB-05",
        "capacity_pallets": 4000,
        "products": [
            ("РЩ-01", "Шоколад «Россия» Тёмный с фундуком", "Шоколадные изделия", 125.0, 54.0),
            ("РЩ-02", "Шоколад «Россия» Золотая марка", "Шоколадные изделия", 160.0, 70.0),
            ("РЩ-03", "Конфеты «Комильфо» фисташка", "Премиум конфеты", 480.0, 210.0),
            ("РЩ-04", "Шоколад «Сударушка» с изюмом", "Шоколадные изделия", 110.0, 48.0),
        ]
    },
    {
        "name": "Победа Вкуса",
        "lat": 55.3830,
        "lng": 39.0330,
        "city": "Егорьевск",
        "state": "Московская область",
        "region_fed": "Центральный ФО",
        "hub_code": "EGO-HUB-06",
        "capacity_pallets": 2700,
        "products": [
            ("ПБ-01", "Шоколад «Победа» 72% Без сахара", "Диетические сладости", 175.0, 78.0),
            ("ПБ-02", "Конфеты «Соната» с лесным орехом", "Шоколадные изделия", 740.0, 330.0),
            ("ПБ-03", "Трюфели «Победа Вкуса» классические", "Шоколадные изделия", 820.0, 375.0),
        ]
    }
]

# Database of 85+ Key Russian Cities with Coordinates and Population
CITIES_RU = [
    {"city": "Москва", "state": "г. Москва", "fed": "Центральный ФО", "lat": 55.7558, "lng": 37.6173, "pop": 13104177, "zip": "101000"},
    {"city": "Санкт-Петербург", "state": "г. Санкт-Петербург", "fed": "Северо-Западный ФО", "lat": 59.9343, "lng": 30.3351, "pop": 5601911, "zip": "190000"},
    {"city": "Новосибирск", "state": "Новосибирская область", "fed": "Сибирский ФО", "lat": 55.0084, "lng": 82.9357, "pop": 1633595, "zip": "630000"},
    {"city": "Екатеринбург", "state": "Свердловская область", "fed": "Уральский ФО", "lat": 56.8389, "lng": 60.6057, "pop": 1588665, "zip": "620000"},
    {"city": "Казань", "state": "Республика Татарстан", "fed": "Приволжский ФО", "lat": 55.8304, "lng": 49.0661, "pop": 1308660, "zip": "420000"},
    {"city": "Нижний Новгород", "state": "Нижегородская область", "fed": "Приволжский ФО", "lat": 56.2965, "lng": 43.9361, "pop": 1249984, "zip": "603000"},
    {"city": "Красноярск", "state": "Красноярский край", "fed": "Сибирский ФО", "lat": 56.0153, "lng": 92.8932, "pop": 1187771, "zip": "660000"},
    {"city": "Челябинск", "state": "Челябинская область", "fed": "Уральский ФО", "lat": 55.1644, "lng": 61.4368, "pop": 1189526, "zip": "454000"},
    {"city": "Самара", "state": "Самарская область", "fed": "Приволжский ФО", "lat": 53.1959, "lng": 50.1002, "pop": 1163645, "zip": "443000"},
    {"city": "Уфа", "state": "Республика Башкортостан", "fed": "Приволжский ФО", "lat": 54.7388, "lng": 55.9721, "pop": 1144809, "zip": "450000"},
    {"city": "Ростов-на-Дону", "state": "Ростовская область", "fed": "Южный ФО", "lat": 47.2357, "lng": 39.7015, "pop": 1142162, "zip": "344000"},
    {"city": "Краснодар", "state": "Краснодарский край", "fed": "Южный ФО", "lat": 45.0393, "lng": 38.9872, "pop": 1099344, "zip": "350000"},
    {"city": "Омск", "state": "Омская область", "fed": "Сибирский ФО", "lat": 54.9885, "lng": 73.3242, "pop": 1125695, "zip": "644000"},
    {"city": "Воронеж", "state": "Воронежская область", "fed": "Центральный ФО", "lat": 51.6755, "lng": 39.2089, "pop": 1057681, "zip": "394000"},
    {"city": "Пермь", "state": "Пермский край", "fed": "Приволжский ФО", "lat": 58.0105, "lng": 56.2502, "pop": 1034015, "zip": "614000"},
    {"city": "Волгоград", "state": "Волгоградская область", "fed": "Южный ФО", "lat": 48.7080, "lng": 44.5133, "pop": 1028036, "zip": "400000"},
    {"city": "Саратов", "state": "Саратовская область", "fed": "Приволжский ФО", "lat": 51.5406, "lng": 46.0086, "pop": 901361, "zip": "410000"},
    {"city": "Тюмень", "state": "Тюменская область", "fed": "Уральский ФО", "lat": 57.1613, "lng": 65.5250, "pop": 847488, "zip": "625000"},
    {"city": "Тольятти", "state": "Самарская область", "fed": "Приволжский ФО", "lat": 53.5303, "lng": 49.3461, "pop": 684709, "zip": "445000"},
    {"city": "Барнаул", "state": "Алтайский край", "fed": "Сибирский ФО", "lat": 53.3606, "lng": 83.7636, "pop": 630877, "zip": "656000"},
    {"city": "Ижевск", "state": "Удмуртская Республика", "fed": "Приволжский ФО", "lat": 56.8498, "lng": 53.2045, "pop": 623472, "zip": "426000"},
    {"city": "Махачкала", "state": "Республика Дагестан", "fed": "Северо-Кавказский ФО", "lat": 42.9849, "lng": 47.5047, "pop": 623254, "zip": "367000"},
    {"city": "Хабаровск", "state": "Хабаровский край", "fed": "Дальневосточный ФО", "lat": 48.4814, "lng": 135.0721, "pop": 617441, "zip": "680000"},
    {"city": "Ульяновск", "state": "Ульяновская область", "fed": "Приволжский ФО", "lat": 54.3142, "lng": 48.4031, "pop": 617352, "zip": "432000"},
    {"city": "Иркутск", "state": "Иркутская область", "fed": "Сибирский ФО", "lat": 52.2871, "lng": 104.3050, "pop": 617264, "zip": "664000"},
    {"city": "Владивосток", "state": "Приморский край", "fed": "Дальневосточный ФО", "lat": 43.1198, "lng": 131.8869, "pop": 603519, "zip": "690000"},
    {"city": "Ярославль", "state": "Ярославская область", "fed": "Центральный ФО", "lat": 57.6261, "lng": 39.8845, "pop": 601429, "zip": "150000"},
    {"city": "Севастополь", "state": "г. Севастополь", "fed": "Южный ФО", "lat": 44.6166, "lng": 33.5254, "pop": 547820, "zip": "299000"},
    {"city": "Томск", "state": "Томская область", "fed": "Сибирский ФО", "lat": 56.4977, "lng": 84.9744, "pop": 556478, "zip": "634000"},
    {"city": "Ставрополь", "state": "Ставропольский край", "fed": "Северо-Кавказский ФО", "lat": 45.0428, "lng": 41.9734, "pop": 547433, "zip": "355000"},
    {"city": "Кемерово", "state": "Кемеровская область", "fed": "Сибирский ФО", "lat": 55.3547, "lng": 86.0888, "pop": 557119, "zip": "650000"},
    {"city": "Набережные Челны", "state": "Республика Татарстан", "fed": "Приволжский ФО", "lat": 55.7437, "lng": 52.4172, "pop": 548434, "zip": "423800"},
    {"city": "Оренбург", "state": "Оренбургская область", "fed": "Приволжский ФО", "lat": 51.7727, "lng": 55.0988, "pop": 543654, "zip": "460000"},
    {"city": "Новокузнецк", "state": "Кемеровская область", "fed": "Сибирский ФО", "lat": 53.7596, "lng": 87.1216, "pop": 537480, "zip": "654000"},
    {"city": "Рязань", "state": "Рязанская область", "fed": "Центральный ФО", "lat": 54.6292, "lng": 39.7366, "pop": 528599, "zip": "390000"},
    {"city": "Пенза", "state": "Пензенская область", "fed": "Приволжский ФО", "lat": 53.2007, "lng": 45.0046, "pop": 520300, "zip": "440000"},
    {"city": "Чебоксары", "state": "Чувашская Республика", "fed": "Приволжский ФО", "lat": 56.1439, "lng": 47.2489, "pop": 497807, "zip": "428000"},
    {"city": "Липецк", "state": "Липецкая область", "fed": "Центральный ФО", "lat": 52.6103, "lng": 39.5947, "pop": 496403, "zip": "398000"},
    {"city": "Калининград", "state": "Калининградская область", "fed": "Северо-Западный ФО", "lat": 54.7104, "lng": 20.4522, "pop": 498260, "zip": "236000"},
    {"city": "Астрахань", "state": "Астраханская область", "fed": "Южный ФО", "lat": 46.3497, "lng": 48.0408, "pop": 475629, "zip": "414000"},
    {"city": "Тула", "state": "Тульская область", "fed": "Центральный ФО", "lat": 54.1961, "lng": 37.6182, "pop": 473622, "zip": "300000"},
    {"city": "Киров", "state": "Кировская область", "fed": "Приволжский ФО", "lat": 58.6035, "lng": 49.6679, "pop": 468212, "zip": "610000"},
    {"city": "Сочи", "state": "Краснодарский край", "fed": "Южный ФО", "lat": 43.6028, "lng": 39.7342, "pop": 466078, "zip": "354000"},
    {"city": "Курск", "state": "Курская область", "fed": "Центральный ФО", "lat": 51.7304, "lng": 36.1927, "pop": 440052, "zip": "305000"},
    {"city": "Улан-Удэ", "state": "Республика Бурятия", "fed": "Дальневосточный ФО", "lat": 51.8272, "lng": 107.6063, "pop": 437565, "zip": "670000"},
    {"city": "Тверь", "state": "Тверская область", "fed": "Центральный ФО", "lat": 56.8587, "lng": 35.9176, "pop": 416219, "zip": "170000"},
    {"city": "Магнитогорск", "state": "Челябинская область", "fed": "Уральский ФО", "lat": 53.4186, "lng": 58.9702, "pop": 410594, "zip": "455000"},
    {"city": "Сургут", "state": "Ханты-Мансийский АО", "fed": "Уральский ФО", "lat": 61.2540, "lng": 73.3962, "pop": 396443, "zip": "628400"},
    {"city": "Брянск", "state": "Брянская область", "fed": "Центральный ФО", "lat": 53.2521, "lng": 34.3717, "pop": 399579, "zip": "241000"},
    {"city": "Иваново", "state": "Ивановская область", "fed": "Центральный ФО", "lat": 56.9972, "lng": 40.9714, "pop": 361644, "zip": "153000"},
    {"city": "Якутск", "state": "Республика Саха (Якутия)", "fed": "Дальневосточный ФО", "lat": 62.0355, "lng": 129.6755, "pop": 355461, "zip": "677000"},
    {"city": "Владимир", "state": "Владимирская область", "fed": "Центральный ФО", "lat": 56.1290, "lng": 40.4066, "pop": 349951, "zip": "600000"},
    {"city": "Белгород", "state": "Белгородская область", "fed": "Центральный ФО", "lat": 50.5954, "lng": 36.5873, "pop": 339978, "zip": "308000"},
    {"city": "Нижний Тагил", "state": "Свердловская область", "fed": "Уральский ФО", "lat": 57.9194, "lng": 59.9650, "pop": 338966, "zip": "622000"},
    {"city": "Калуга", "state": "Калужская область", "fed": "Центральный ФО", "lat": 54.5293, "lng": 36.2754, "pop": 337058, "zip": "248000"},
    {"city": "Чита", "state": "Забайкальский край", "fed": "Дальневосточный ФО", "lat": 52.0340, "lng": 113.5009, "pop": 351784, "zip": "672000"},
    {"city": "Грозный", "state": "Чеченская Республика", "fed": "Северо-Кавказский ФО", "lat": 43.3177, "lng": 45.6982, "pop": 328533, "zip": "364000"},
    {"city": "Волжский", "state": "Волгоградская область", "fed": "Южный ФО", "lat": 48.7858, "lng": 44.7797, "pop": 321479, "zip": "404100"},
    {"city": "Смоленск", "state": "Смоленская область", "fed": "Центральный ФО", "lat": 54.7818, "lng": 32.0401, "pop": 316570, "zip": "214000"},
    {"city": "Саранск", "state": "Республика Мордовия", "fed": "Приволжский ФО", "lat": 54.1838, "lng": 45.1838, "pop": 314871, "zip": "430000"},
    {"city": "Череповец", "state": "Вологодская область", "fed": "Северо-Западный ФО", "lat": 59.1227, "lng": 37.9035, "pop": 305185, "zip": "162600"},
    {"city": "Вологда", "state": "Вологодская область", "fed": "Северо-Западный ФО", "lat": 59.2205, "lng": 39.8915, "pop": 313944, "zip": "160000"},
    {"city": "Владикавказ", "state": "Республика Северная Осетия", "fed": "Северо-Кавказский ФО", "lat": 43.0367, "lng": 44.6678, "pop": 295830, "zip": "362000"},
    {"city": "Подольск", "state": "Московская область", "fed": "Центральный ФО", "lat": 55.4312, "lng": 37.5458, "pop": 314906, "zip": "142100"},
    {"city": "Мурманск", "state": "Мурманская область", "fed": "Северо-Западный ФО", "lat": 68.9585, "lng": 33.0827, "pop": 270103, "zip": "183000"},
    {"city": "Тамбов", "state": "Тамбовская область", "fed": "Центральный ФО", "lat": 52.7212, "lng": 41.4523, "pop": 261803, "zip": "392000"},
    {"city": "Стерлитамак", "state": "Республика Башкортостан", "fed": "Приволжский ФО", "lat": 53.6333, "lng": 55.9500, "pop": 277410, "zip": "453100"},
    {"city": "Петрозаводск", "state": "Республика Карелия", "fed": "Северо-Западный ФО", "lat": 61.7849, "lng": 34.3469, "pop": 234897, "zip": "185000"},
    {"city": "Кострома", "state": "Костромская область", "fed": "Центральный ФО", "lat": 57.7665, "lng": 40.9269, "pop": 267481, "zip": "156000"},
    {"city": "Нижневартовск", "state": "Ханты-Мансийский АО", "fed": "Уральский ФО", "lat": 60.9385, "lng": 76.5589, "pop": 283202, "zip": "628600"},
    {"city": "Новороссийск", "state": "Краснодарский край", "fed": "Южный ФО", "lat": 44.7244, "lng": 37.7675, "pop": 262293, "zip": "353900"},
    {"city": "Йошкар-Ола", "state": "Республика Марий Эл", "fed": "Приволжский ФО", "lat": 56.6388, "lng": 47.8908, "pop": 281119, "zip": "424000"},
    {"city": "Таганрог", "state": "Ростовская область", "fed": "Южный ФО", "lat": 47.2362, "lng": 38.8969, "pop": 245120, "zip": "347900"},
    {"city": "Сыктывкар", "state": "Республика Коми", "fed": "Северо-Западный ФО", "lat": 61.6688, "lng": 50.8357, "pop": 220580, "zip": "167000"},
    {"city": "Нальчик", "state": "Кабардино-Балкарская Республика", "fed": "Северо-Кавказский ФО", "lat": 43.4853, "lng": 43.6071, "pop": 247057, "zip": "360000"},
    {"city": "Шахты", "state": "Ростовская область", "fed": "Южный ФО", "lat": 47.7086, "lng": 40.2162, "pop": 226000, "zip": "346500"},
    {"city": "Дзержинск", "state": "Нижегородская область", "fed": "Приволжский ФО", "lat": 56.2389, "lng": 43.4631, "pop": 218630, "zip": "606000"},
    {"city": "Братск", "state": "Иркутская область", "fed": "Сибирский ФО", "lat": 56.1528, "lng": 101.6142, "pop": 224071, "zip": "665700"},
    {"city": "Орск", "state": "Оренбургская область", "fed": "Приволжский ФО", "lat": 51.2049, "lng": 58.5668, "pop": 189195, "zip": "462400"},
    {"city": "Ангарск", "state": "Иркутская область", "fed": "Сибирский ФО", "lat": 52.5444, "lng": 103.8882, "pop": 221296, "zip": "665800"},
    {"city": "Благовещенск", "state": "Амурская область", "fed": "Дальневосточный ФО", "lat": 50.2796, "lng": 127.5405, "pop": 241437, "zip": "675000"},
    {"city": "Энгельс", "state": "Саратовская область", "fed": "Приволжский ФО", "lat": 51.5036, "lng": 46.1219, "pop": 225401, "zip": "413100"},
    {"city": "Старый Оскол", "state": "Белгородская область", "fed": "Центральный ФО", "lat": 51.2970, "lng": 37.8340, "pop": 221676, "zip": "309500"},
    {"city": "Великий Новгород", "state": "Новгородская область", "fed": "Северо-Западный ФО", "lat": 58.5215, "lng": 31.2755, "pop": 224286, "zip": "173000"},
    {"city": "Псков", "state": "Псковская область", "fed": "Северо-Западный ФО", "lat": 57.8136, "lng": 28.3496, "pop": 193082, "zip": "180000"},
    {"city": "Архангельск", "state": "Архангельская область", "fed": "Северо-Западный ФО", "lat": 64.5473, "lng": 40.5433, "pop": 301199, "zip": "163000"},
]

CARRIERS_RU = [
    {"name": "Деловые Линии", "code": "DLIN", "base_rate": 84.0},
    {"name": "ПЭК", "code": "PEK", "base_rate": 82.5},
    {"name": "Монополия", "code": "MNPL", "base_rate": 88.0},
    {"name": "Globaltruck", "code": "GTRK", "base_rate": 86.5},
    {"name": "Байкал Сервис", "code": "BKL", "base_rate": 79.0},
    {"name": "КИТ (GTD)", "code": "KIT", "base_rate": 76.5},
    {"name": "Возовоз", "code": "VZVOZ", "base_rate": 80.0},
    {"name": "СДЭК Cargo", "code": "CDEK", "base_rate": 92.0},
]

DRIVERS_RU = [
    ("Иванов Алексей Петрович", "СКЗИ-РФ-048218", "Деловые Линии", "А741ВВ 77"),
    ("Смирнов Дмитрий Сергеевич", "СКЗИ-РФ-019384", "ПЭК", "О392МН 197"),
    ("Кузнецов Михаил Юрьевич", "СКЗИ-РФ-084729", "Монополия", "Е512СТ 116"),
    ("Васильев Сергей Николаевич", "СКЗИ-РФ-032194", "Globaltruck", "В804УК 63"),
    ("Попов Андрей Владимирович", "СКЗИ-РФ-094182", "Байкал Сервис", "М155АХ 78"),
    ("Соколов Игорь Валерьевич", "СКЗИ-РФ-056231", "КИТ (GTD)", "К632ОО 54"),
    ("Михайлов Роман Александрович", "СКЗИ-РФ-071490", "Возовоз", "Н420РР 36"),
    ("Федоров Виктор Павлович", "СКЗИ-РФ-023819", "СДЭК Cargo", "С918ТТ 161"),
    ("Морозов Константин Борисович", "СКЗИ-РФ-068391", "Деловые Линии", "У307ХХ 77"),
    ("Волков Денис Сергеевич", "СКЗИ-РФ-041920", "ПЭК", "Р554ВЕ 123"),
    ("Алексеев Максим Дмитриевич", "СКЗИ-РФ-089123", "Монополия", "Т781КМ 799"),
    ("Лебедев Артём Олегович", "СКЗИ-РФ-037461", "Globaltruck", "Х249ЕО 72"),
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two GPS points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    # Road tortuosity / winding coefficient in Russia (avg ~1.18x straight-line)
    return round(R * c * 1.18, 1)


def setup_database_ru(db_path: str):
    """Create optimized Russian logistics schema with indexes and WAL mode."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")

    cur.executescript("""
    DROP TABLE IF EXISTS shipments;
    DROP TABLE IF EXISTS factories;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS routes;
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS agent_logs;

    CREATE TABLE factories (
        factory_id INTEGER PRIMARY KEY AUTOINCREMENT,
        factory_name TEXT UNIQUE NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        hub_code TEXT NOT NULL,
        capacity_pallets INTEGER NOT NULL,
        assigned_products_count INTEGER DEFAULT 0,
        total_shipments INTEGER DEFAULT 0,
        total_sales REAL DEFAULT 0.0
    );

    CREATE TABLE products (
        product_id TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        division TEXT NOT NULL,
        factory_name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL NOT NULL
    );

    CREATE TABLE shipments (
        row_id INTEGER PRIMARY KEY,
        order_id TEXT NOT NULL,
        order_date TEXT NOT NULL,
        ship_date TEXT NOT NULL,
        ship_mode TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        country TEXT NOT NULL,
        dest_city TEXT NOT NULL,
        dest_state TEXT NOT NULL,
        dest_postal_code TEXT NOT NULL,
        division TEXT NOT NULL,
        region TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        sales REAL NOT NULL,
        units INTEGER NOT NULL,
        gross_profit REAL NOT NULL,
        manufacturing_cost REAL NOT NULL,
        factory_name TEXT NOT NULL,
        origin_city TEXT NOT NULL,
        origin_state TEXT NOT NULL,
        origin_lat REAL NOT NULL,
        origin_lng REAL NOT NULL,
        dest_lat REAL NOT NULL,
        dest_lng REAL NOT NULL,
        distance_miles REAL NOT NULL,
        transit_days INTEGER NOT NULL,
        truck_type TEXT NOT NULL,
        carrier TEXT NOT NULL,
        carrier_code TEXT NOT NULL,
        driver_name TEXT NOT NULL,
        driver_id TEXT NOT NULL,
        truck_id TEXT NOT NULL,
        status TEXT NOT NULL,
        rate_per_mile REAL NOT NULL,
        freight_cost REAL NOT NULL,
        fuel_cost REAL NOT NULL,
        weight_lbs REAL NOT NULL,
        ton_miles REAL NOT NULL,
        co2_kg REAL NOT NULL
    );

    CREATE TABLE routes (
        corridor_id INTEGER PRIMARY KEY AUTOINCREMENT,
        corridor_name TEXT NOT NULL,
        origin_factory TEXT NOT NULL,
        origin_state TEXT NOT NULL,
        origin_lat REAL NOT NULL,
        origin_lng REAL NOT NULL,
        dest_state TEXT NOT NULL,
        dest_city TEXT NOT NULL,
        dest_lat REAL NOT NULL,
        dest_lng REAL NOT NULL,
        shipment_count INTEGER NOT NULL,
        total_units INTEGER NOT NULL,
        total_sales REAL NOT NULL,
        avg_distance_miles REAL NOT NULL,
        avg_transit_days REAL NOT NULL,
        total_ton_miles REAL NOT NULL
    );

    CREATE TABLE agents (
        agent_id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        decisions_count INTEGER DEFAULT 0,
        efficiency_score REAL DEFAULT 0.0,
        last_action TEXT NOT NULL,
        last_action_time TEXT NOT NULL,
        telemetry_json TEXT NOT NULL
    );

    CREATE TABLE agent_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT
    );

    -- Optimized query indices
    CREATE INDEX idx_shipments_factory ON shipments(factory_name);
    CREATE INDEX idx_shipments_ship_mode ON shipments(ship_mode);
    CREATE INDEX idx_shipments_state ON shipments(dest_state);
    CREATE INDEX idx_shipments_status ON shipments(status);
    CREATE INDEX idx_shipments_order_date ON shipments(order_date);
    CREATE INDEX idx_shipments_carrier ON shipments(carrier);
    CREATE INDEX idx_shipments_truck_type ON shipments(truck_type);
    CREATE INDEX idx_shipments_product ON shipments(product_id);
    CREATE INDEX idx_routes_corridor ON routes(origin_factory, dest_state);
    CREATE INDEX idx_logs_agent ON agent_logs(agent_id, timestamp);
    """)

    conn.commit()
    conn.close()


def generate_russian_dataset():
    """Build and enrich 10,250 realistic logistics shipments across Russia."""
    print("=" * 76)
    print("   MAVEN FREIGHT OS // РОССИЙСКИЙ ЛОГИСТИЧЕСКИЙ ПАЙПЛАЙН (data_pipeline_ru)")
    print("=" * 76)

    setup_database_ru(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Insert factories & products
    print("[*] Запись фабрик и продуктовой номенклатуры...")
    all_products = []
    for f in FACTORIES_RU:
        for p in f["products"]:
            all_products.append({
                "product_id": p[0],
                "product_name": p[1],
                "division": p[2],
                "factory": f["name"],
                "unit_price": p[3],
                "unit_cost": p[4],
            })
            cur.execute("""
                INSERT INTO products (product_id, product_name, division, factory_name, unit_price, unit_cost)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (p[0], p[1], p[2], f["name"], p[3], p[4]))

    # Prepare population-weighted city sampling
    city_weights = [c["pop"] ** 0.65 for c in CITIES_RU]

    # Generate 10,250 shipments spanning 2023-01-01 to 2024-12-25
    TOTAL_ROWS = 10250
    print(f"[*] Генерация и обогащение {TOTAL_ROWS:,} рейсов по всей территории РФ...")

    ship_modes = [
        ("Сборный груз (LTL)", 0.45, 1.0),
        ("Выделенная еврофура (FTL)", 0.35, 1.15),
        ("Стандартная доставка", 0.15, 0.95),
        ("Экспресс-доставка РЦ", 0.05, 1.45),
    ]

    base_start_date = datetime(2023, 1, 10)
    date_span_days = 715

    shipments = []
    corridors = defaultdict(lambda: {
        "count": 0, "units": 0, "sales": 0.0,
        "distances": [], "transit_days": [], "ton_miles": 0.0,
        "cities": Counter(), "lats": [], "lngs": []
    })
    factory_stats = defaultdict(lambda: {"shipments": 0, "sales": 0.0, "products": set()})

    for row_id in range(1, TOTAL_ROWS + 1):
        rng = random.Random(row_id + 54321)

        # Pick factory & product
        factory = rng.choice(FACTORIES_RU)
        prod_tuple = rng.choice(factory["products"])
        pid, pname, pdiv, pprice, pcost = prod_tuple

        # Pick destination city based on population weights
        dest_city_obj = rng.choices(CITIES_RU, weights=city_weights, k=1)[0]

        # Order Date & Ship Date
        day_offset = rng.randint(0, date_span_days)
        order_dt = base_start_date + timedelta(days=day_offset)

        # Distance calculation
        dist_km = haversine_km(factory["lat"], factory["lng"], dest_city_obj["lat"], dest_city_obj["lng"])
        if dist_km < 35.0:
            dist_km = 35.0  # Городской развоз / подача по области

        # Transit days based on real speed (avg ~600 km/day for truck with driver rest rules)
        cal_transit_days = max(1, int(math.ceil(dist_km / 550.0)))
        if cal_transit_days > 12:
            cal_transit_days = 12

        # Ship mode
        mode_roll = rng.random()
        cumulative = 0.0
        chosen_mode, mode_rate_mult = "Сборный груз (LTL)", 1.0
        for sm_name, sm_prob, sm_mult in ship_modes:
            cumulative += sm_prob
            if mode_roll <= cumulative:
                chosen_mode = sm_name
                mode_rate_mult = sm_mult
                break

        # Ship Date
        ship_dt = order_dt + timedelta(days=cal_transit_days)
        order_date_str = order_dt.strftime("%Y-%m-%d")
        ship_date_str = ship_dt.strftime("%Y-%m-%d")

        # Units (boxes / pallets): 2 to 45
        units = rng.randint(2, 40) if chosen_mode != "Выделенная еврофура (FTL)" else rng.randint(20, 66)
        sales = round(units * pprice * rng.uniform(0.92, 1.05), 2)
        mfg_cost = round(units * pcost, 2)
        gross_profit = round(sales - mfg_cost, 2)

        # Equipment selection
        if pdiv in ("Шоколадные изделия", "Премиум конфеты"):
            # ШОКОЛАД ТРЕБУЕТ ТЕМПЕРАТУРНЫЙ РЕЖИМ +15°C
            if dist_km > 300:
                truck_type = "Рефрижератор 86м³" if rng.random() < 0.85 else "Изотермический фургон 15т"
            else:
                truck_type = "Изотермический фургон 15т" if units > 8 else "Газель Next 3т"
        else:
            if units > 25 or dist_km > 700:
                truck_type = "Еврофура 20т Тент 90м³"
            elif dist_km < 200 and units <= 10:
                truck_type = "Газель Next 3т"
            else:
                truck_type = "Изотермический фургон 15т" if rng.random() < 0.6 else "Еврофура 20т Тент 90м³"

        # Carrier & Driver
        carrier_choice = rng.choice(CARRIERS_RU)
        driver_tuple = rng.choice(DRIVERS_RU)
        driver_name = driver_tuple[0]
        driver_id = driver_tuple[1]
        carrier_name = carrier_choice["name"]
        carrier_code = carrier_choice["code"]
        truck_id = driver_tuple[3] if rng.random() < 0.7 else f"В{rng.randint(100, 999)}РР {rng.choice(['77', '197', '78', '116', '63', '54', '161'])}"

        # Status logic based on date
        if order_dt >= datetime(2024, 12, 10):
            st_roll = rng.random()
            if st_roll < 0.35:
                status = "Запланирован"
            elif st_roll < 0.70:
                status = "Погрузка на РЦ"
            else:
                status = "В пути"
        elif order_dt >= datetime(2024, 11, 1):
            st_roll = rng.random()
            if st_roll < 0.55:
                status = "Доставлен"
            elif st_roll < 0.85:
                status = "В пути"
            else:
                status = "Погрузка на РЦ"
        else:
            status = "Доставлен" if rng.random() < 0.985 else "В пути"

        # Tariffs & Economics (65 - 115 ₽/км)
        base_rate = carrier_choice["base_rate"] * mode_rate_mult
        if truck_type == "Рефрижератор 86м³":
            base_rate += 16.0  # +15°C постоянный терморежим
        elif truck_type == "Газель Next 3т":
            base_rate = min(58.0, base_rate * 0.65)
        elif truck_type == "Изотермический фургон 15т":
            base_rate *= 0.92

        rate_per_km = round(base_rate + rng.uniform(-3.5, 3.5), 1)
        rate_per_km = max(65.0, min(118.0, rate_per_km))

        # Weight in kg (~14 kg per candy carton/box)
        weight_kg = units * 14.2
        # Ton-km
        ton_km = round((dist_km * weight_kg) / 1000.0, 1)

        # Freight cost allocated to shipment
        if chosen_mode == "Выделенная еврофура (FTL)":
            freight_cost = round(dist_km * rate_per_km, 2)
        else:
            # Сборный груз (LTL)
            freight_cost = round(2400.0 + (dist_km * rate_per_km * (0.018 + 0.011 * units)), 2)

        # Fuel & Platon: Diesel 64 ₽/l, 32 l/100km = 20.48 ₽/km + Platon 3.05 ₽/km = ~23.53 ₽/km
        platon_rate = 3.05 if truck_type != "Газель Next 3т" else 0.0
        fuel_cost = round(dist_km * (20.48 + platon_rate), 2)
        co2_kg = round(dist_km * 0.88 * (0.2 + weight_kg / 20000.0), 1)

        cust_id = f"RU-{rng.randint(10000, 99999)}"
        order_id = f"RU-{order_dt.year}-{row_id:06d}-{pid}"

        shipments.append((
            row_id, order_id, order_date_str, ship_date_str, chosen_mode, cust_id,
            "Россия", dest_city_obj["city"], dest_city_obj["state"], dest_city_obj["zip"],
            pdiv, dest_city_obj["fed"],
            pid, pname, sales, units, gross_profit, mfg_cost,
            factory["name"], factory["city"], factory["state"], factory["lat"], factory["lng"],
            dest_city_obj["lat"], dest_city_obj["lng"], dist_km, cal_transit_days, truck_type,
            carrier_name, carrier_code, driver_name, driver_id, truck_id,
            status, rate_per_km, freight_cost, fuel_cost, weight_kg,
            ton_km, co2_kg
        ))

        # Corridor aggregation
        corr_key = (factory["name"], dest_city_obj["state"])
        cdata = corridors[corr_key]
        cdata["count"] += 1
        cdata["units"] += units
        cdata["sales"] += sales
        cdata["distances"].append(dist_km)
        cdata["transit_days"].append(cal_transit_days)
        cdata["ton_miles"] += ton_km
        cdata["cities"][dest_city_obj["city"]] += 1
        cdata["lats"].append(dest_city_obj["lat"])
        cdata["lngs"].append(dest_city_obj["lng"])

        fstat = factory_stats[factory["name"]]
        fstat["shipments"] += 1
        fstat["sales"] += sales
        fstat["products"].add(pid)

    print(f"[*] Вставка {len(shipments):,} строк в таблицу shipments...")
    cur.executemany("""
        INSERT INTO shipments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, shipments)

    # 2. Insert factories with computed stats
    print("[*] Запись агрегированной статистики по фабрикам...")
    for f in FACTORIES_RU:
        fname = f["name"]
        fstat = factory_stats[fname]
        cur.execute("""
            INSERT INTO factories (factory_name, latitude, longitude, city, state, hub_code, capacity_pallets,
                                   assigned_products_count, total_shipments, total_sales)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            fname, f["lat"], f["lng"], f["city"], f["state"], f["hub_code"],
            f["capacity_pallets"], len(fstat["products"]), fstat["shipments"], round(fstat["sales"], 2)
        ))

    # 3. Insert routes / corridors
    print("[*] Формирование межрегиональных транспортных коридоров РФ...")
    route_rows = []
    for (fname, dest_state), cdata in corridors.items():
        f_obj = next(f for f in FACTORIES_RU if f["name"] == fname)
        top_city = cdata["cities"].most_common(1)[0][0]
        avg_lat = round(sum(cdata["lats"]) / len(cdata["lats"]), 4)
        avg_lng = round(sum(cdata["lngs"]) / len(cdata["lngs"]), 4)
        avg_dist = round(sum(cdata["distances"]) / len(cdata["distances"]), 1)
        avg_transit = round(sum(cdata["transit_days"]) / len(cdata["transit_days"]), 2)
        corridor_name = f"{fname} ({f_obj['city']}) ➔ {top_city} ({dest_state})"

        route_rows.append((
            corridor_name, fname, f_obj["state"], f_obj["lat"], f_obj["lng"],
            dest_state, top_city, avg_lat, avg_lng,
            cdata["count"], cdata["units"], round(cdata["sales"], 2),
            avg_dist, avg_transit, round(cdata["ton_miles"], 2)
        ))

    cur.executemany("""
        INSERT INTO routes (corridor_name, origin_factory, origin_state, origin_lat, origin_lng,
                            dest_state, dest_city, dest_lat, dest_lng,
                            shipment_count, total_units, total_sales,
                            avg_distance_miles, avg_transit_days, total_ton_miles)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, route_rows)

    # 4. Russian Autonomous Logistics Agents
    print("[*] Инициализация российских логистических саб-агентов (Апекс, Следопыт, Часовой, Веритас)...")
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    agents_init_ru = [
        (
            "APX-01",
            "Апекс (Диспетчер FTL/LTL)",
            "Интеллектуальное пакетирование и распределение по ТК",
            "АКТИВЕН",
            1480,
            97.4,
            "Сформирован сборный автопоезд на РЦ Екатеринбург. 18 заказов консолидированы в Рефрижератор 86м³.",
            now_iso,
            json.dumps({
                "assigned_loads_today": 42,
                "carrier_fill_rate_pct": 95.8,
                "pending_queue_size": 31,
                "preferred_carriers": ["Деловые Линии", "ПЭК", "Монополия"],
                "active_trailer_types": {"Рефрижератор 86м³": 68, "Еврофура 20т Тент 90м³": 54, "Изотермический фургон 15т": 22, "Газель Next 3т": 14}
            }, ensure_ascii=False)
        ),
        (
            "PTH-02",
            "Следопыт (Оптимизатор маршрутов)",
            "Расчет коридоров М11/М12/М4/М5 и контроль ЕСТР",
            "АКТИВЕН",
            2640,
            98.6,
            "Маршрут Самара ➔ Казань перенаправлен по новой скоростной трассе М-12; экономия времени рейса 4.8 часа.",
            now_iso,
            json.dumps({
                "deadhead_reduction_pct": 19.4,
                "avg_haul_distance_km": 1145.0,
                "fuel_burn_rate_lpk": 0.32,
                "platon_compliance_pct": 100.0,
                "toll_highway_utilization_pct": 74.2
            }, ensure_ascii=False)
        ),
        (
            "SNT-03",
            "Часовой (Телематика автопарка и ГЛОНАСС)",
            "Спутниковый мониторинг ГЛОНАСС/GPS, контроль терморежима (+15°C)",
            "АКТИВЕН",
            4210,
            98.1,
            "168 бортов на линии под контролем ГЛОНАСС. Холодовая цепь +14.8°C выдержана на 100%. Предупреждений 0.",
            now_iso,
            json.dumps({
                "active_in_transit_trucks": 168,
                "on_time_delivery_rate_pct": 97.2,
                "glonass_signal_health_pct": 99.8,
                "temp_excursion_incidents": 0,
                "avg_transit_duration_days": 3.4
            }, ensure_ascii=False)
        ),
        (
            "VRT-04",
            "Веритас (Логистический аудитор)",
            "Юнит-экономика перевозок, аудит тарифов, расчет Платон и ГСМ",
            "АКТИВЕН",
            1150,
            99.4,
            "Аудит 10 250 накладных закрыт. Затраты на ГСМ (дизель 64 ₽/л) и сбор Платон (3.05 ₽/км) полностью сверены.",
            now_iso,
            json.dumps({
                "avg_freight_rate_per_km_rub": 85.4,
                "fuel_and_platon_share_pct": 28.1,
                "freight_operating_margin_pct": 26.4,
                "audited_invoices_total": 10250,
                "discrepancy_rate_pct": 0.02
            }, ensure_ascii=False)
        )
    ]

    cur.executemany("""
        INSERT INTO agents (agent_id, agent_name, role, status, decisions_count, efficiency_score,
                            last_action, last_action_time, telemetry_json)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, agents_init_ru)

    # Initial Decision Logs in Russian
    initial_logs_ru = [
        ("APX-01", "Апекс (Диспетчер FTL/LTL)", now_iso, "SUCCESS", "Автономное пакетирование груза: объединено 9 партий конфет фабрики «Славянка» в рефрижератор ТК «Деловые Линии» на РЦ Краснодар.", json.dumps({"origin": "Старый Оскол", "destination": "Краснодар", "savings_rub": 34800.0}, ensure_ascii=False)),
        ("PTH-02", "Следопыт (Оптимизатор маршрутов)", now_iso, "INFO", "Построен оптимальный коридор Кемерово ➔ Новосибирск (260 км). Режим труда водителя РПО/СКЗИ подтверждён.", json.dumps({"highway": "Р-255 Сибирь", "km": 260}, ensure_ascii=False)),
        ("SNT-03", "Часовой (Телематика автопарка и ГЛОНАСС)", now_iso, "INFO", "Связь со спутниками ГЛОНАСС стабильна по всем 6 производственным хабам РФ. Датчики холода +15°C в норме.", json.dumps({"status": "ВСЕ_СИСТЕМЫ_НОРМА"}, ensure_ascii=False)),
        ("VRT-04", "Веритас (Логистический аудитор)", now_iso, "ACTION", "Проведён расчет транспортной рентабельности по 10 250 рейсам. Чистая маржинальность сети составила 26.4%.", json.dumps({"audited_shipments": TOTAL_ROWS}, ensure_ascii=False))
    ]

    cur.executemany("""
        INSERT INTO agent_logs (agent_id, agent_name, timestamp, level, message, details_json)
        VALUES (?,?,?,?,?,?)
    """, initial_logs_ru)

    conn.commit()

    # Metrics summary
    cur.execute("SELECT COUNT(*), SUM(sales), SUM(gross_profit), SUM(distance_miles), SUM(ton_miles), AVG(transit_days) FROM shipments")
    tot_count, tot_sales, tot_profit, tot_km, tot_ton_km, avg_transit = cur.fetchone()

    cur.execute("SELECT status, COUNT(*) FROM shipments GROUP BY status ORDER BY COUNT(*) DESC")
    status_counts = cur.fetchall()

    cur.execute("SELECT truck_type, COUNT(*) FROM shipments GROUP BY truck_type ORDER BY COUNT(*) DESC")
    truck_counts = cur.fetchall()

    cur.execute("SELECT corridor_name, shipment_count, avg_distance_miles FROM routes ORDER BY shipment_count DESC LIMIT 5")
    top_routes = cur.fetchall()

    conn.close()

    print("\n" + "=" * 76)
    print("                РЕЗУЛЬТАТЫ ГЕНЕРАЦИИ РОССИЙСКОГО ДАТАСЕТА")
    print("=" * 76)
    print(f" Всего рейсов сформировано:  {tot_count:,}")
    print(f" Общий грузооборот выручки:   {tot_sales:,.2f} ₽")
    print(f" Валовая прибыль (Gross):     {tot_profit:,.2f} ₽")
    print(f" Суммарный пробег автопарка: {tot_km:,.1f} км")
    print(f" Тонно-километры (ТКМ):      {tot_ton_km:,.1f} т·км")
    print(f" Средний срок доставки:      {avg_transit:.2f} дн.")
    print("-" * 76)
    print(" Распределение по статусам рейсов:")
    for st, c in status_counts:
        pct = (c / tot_count) * 100
        print(f"   - {st:<20}: {c:>6,} ({pct:.1f}%)")
    print("-" * 76)
    print(" Распределение по подвижному составу:")
    for tt, c in truck_counts:
        pct = (c / tot_count) * 100
        print(f"   - {tt:<32}: {c:>6,} ({pct:.1f}%)")
    print("-" * 76)
    print(" Топ-5 транспортных коридоров РФ:")
    for cname, cnt, m in top_routes:
        print(f"   * {cname:<52} | {cnt:>5,} рейсов | {m:>6.1f} км")
    print("=" * 76)
    print(f"[УСПЕШНО] База данных РФ сохранена в: {DB_PATH}")


if __name__ == "__main__":
    generate_russian_dataset()
