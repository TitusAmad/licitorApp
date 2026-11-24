# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 09:54:35 2026

@author: benja
"""

from bs4 import BeautifulSoup
import re
import requests
from datetime import datetime
from datetime import timedelta
import json
import unicodedata

#GENERIQUE

#OBJETS

def merge_dict(new_dict, past_dict):
    
    past_keys = past_dict.keys()
    new_keys = new_dict.keys()
    for ann_id in past_keys:
        if (ann_id not in new_keys):
            new_dict[ann_id] = past_dict[ann_id]
    return new_dict

#FILE

def load_json(path):
    with open(path, "r") as file:
        data = json.load(file)
    return data

def save_html(soup, path, ann_id):
    
    html_file = path / f"{ann_id}.html"

    html_file.write_text(
        str(soup),
        encoding="utf-8",
    )
    
def save_output(obj, full_path):
    
    with full_path.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            obj,
            file,
            ensure_ascii=False,
            indent=2,
        )

#NETTOYAGE

def normalize_string(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def pluralize(text: str, nbr: int, genre: str):
    
    if nbr == 0:
        if genre == "M":
            out = "Aucun"
        else:
            out = "Aucune"
    elif nbr == 1:
        if genre == "M":
            out = "Un"
        else:
            out = "Une"
    else:
        text = text + "s"
        out = str(nbr)
    
    out = " ".join([out, text])
    
    return out

def clean_text(value):
    """Nettoie les espaces et retours à la ligne."""

    if not value:
        return None

    value = value.replace("\xa0", " ")

    return re.sub(r"\s+", " ", value).strip()

#EXTRACTION DEPUIS CONTENU

def find_line(lines, pattern):
    """Recherche une ligne correspondant à une regex."""

    regex = re.compile(
        pattern,
        re.IGNORECASE,
    )

    for line in lines:

        if regex.search(line):
            return line

    return None

def extract_announcement_id(url, text):
    """Extrait le numéro d'annonce."""

    match = re.search(
        r"/annonce/(?:[^/]+/){3}[^/]+/(\d+)\.html",
        url,
    )

    if match:
        return match.group(1)

    match = re.search(
        r"Annonce n°\s*(\d+)",
        text,
        re.IGNORECASE,
    )

    if match:
        return match.group(1)

    return None

def handle_prices(lot, price):
    
    """Récupération Mise à Prix et Prix vente final"""
    
    mise_obj = None
    vente_obj = None
    
    h3_txt = price.get_text(" ", strip=True)
    if "Adjudication" in h3_txt:
        mise_obj = lot.select_one("h4")
        vente_obj = price
    else:
        mise_obj = price
    
    return [mise_obj, vente_obj]

def extract_money(text):
    """
    Extrait un montant en euros depuis un texte.

    Exemples :
        "Mise à prix : 190 000 €"       -> 190000.0
        "Mise à prix : 1 250 000 €"     -> 1250000.0
        "Mise à prix : 203 348,06 €"    -> 203348.06
        "Mise à prix : 203348,06 €"     -> 203348.06
        "Mise à prix : 1.250.000,50 €"  -> 1250000.50
    """

    if not text:
        return None

    match = re.search(
        r"(\d[\d\s.]*(?:,\d{1,2})?)\s*€",
        str(text)
    )

    if not match:
        return None

    value = match.group(1)

    # Supprime les séparateurs de milliers
    value = value.replace(" ", "")
    value = value.replace(".", "")

    # Convertit la virgule décimale française en point
    value = value.replace(",", ".")

    return int(float(value))


def extract_surface(text):
    """
    Extrait toutes les surfaces exprimées en m².

    Exemple :
    'de 43,16 m²'
    -> [43.16]
    """

    if not text:
        return []

    matches = re.findall(
        r"(\d+(?:[.,]\d+)?)\s*m²",
        text,
        flags=re.IGNORECASE,
    )

    return [
        float(value.replace(",", "."))
        for value in matches
    ]

def extract_type(lots_content):
    
    types = []
    
    sous_lots = lots_content.select(".SousLot")

    for sous_lot in sous_lots:
        
        lot_title = sous_lot.select_one("h2")
    
        if lot_title:
            part_type = clean_text(
                lot_title.get_text(" ", strip=True)
            )
            types.append(part_type)
            
    return types

def extract_description(lots_content):
    
    desc = []
    
    sous_lots = lots_content.select(".SousLot")

    for sous_lot in sous_lots:
    
        if sous_lot:
            el = clean_text(
                sous_lot.get_text(" ", strip=True)
            )
            desc.append(el)
            
    return desc
    

def extract_occupation(lots_content):

    text = clean_text(
        lots_content.get_text(" ", strip=True)
    )

    if not text:
        return None
    
    normText = normalize_string(text)
    
    if "a verifier" in normText:
        return None

    lib_keys = ["inoccupe", "libre"]
    occup_keys = ["occup"]

    for el in lib_keys:
        if el in normText:
            return "Libre"
    
    for el in occup_keys:
        if el in normText:
            return "Occupé"
    
    return None

def extract_coordinates(href):
    if not href:
        return None

    match = re.search(
        r'[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)',
        href
    )

    if not match:
        return None

    return {
        "latitude": float(match.group(1)),
        "longitude": float(match.group(2))
    }

def extract_partner_stats(partner_content):
    
    stats = {}
    
    els = partner_content.find_all("div", attrs={"class":"PartnerOfferValue"})
    
    if els:
        
        clean_stats = []
        for el in els:
            stat = extract_money(el)
            clean_stats.append(stat)
        
        stats["min"] = clean_stats[0]
        stats["avg"] = clean_stats[1]
        stats["max"] = clean_stats[2]
        
    return stats

def parse_visite_dt(visite):
    
    """
    Transforme un texte de visite en liste de dates.

    Exemple :
        'Visite mardi 10 novembre 2026 de 9h à 12h
         et mercredi 11 novembre 2026 de 14h à 16h'

    Retourne :
        [
            '2026-11-10 09:00',
            '2026-11-11 14:00'
        ]

    Retourne la date la plus récente >= aujourdhui
    """

    MOIS = {
        "janvier": 1,
        "février": 2,
        "fevrier": 2,
        "mars": 3,
        "avril": 4,
        "mai": 5,
        "juin": 6,
        "juillet": 7,
        "août": 8,
        "aout": 8,
        "septembre": 9,
        "octobre": 10,
        "novembre": 11,
        "décembre": 12,
        "decembre": 12,
    }

    if not visite:
        return []

    pattern = re.compile(
        r"""
        (?P<jour>\d{1,2})
        (?:er)?
        \s+
        (?P<mois>[a-zéèêëàâäîïôöùûüç]+)
        \s+
        (?P<annee>\d{4})
        \s+
        (?:de|à|a)?\s*
        (?P<heure>\d{1,2})
        \s*
        h
        \s*
        (?P<minute>\d{2})?
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    matches = []

    for match in pattern.finditer(visite.lower()):
        
        jour = int(match.group("jour"))
        mois_nom = match.group("mois")
        annee = int(match.group("annee"))
        heure = int(match.group("heure"))
        minute = int(match.group("minute") or 0)

        mois = MOIS.get(mois_nom)

        if mois is None:
            continue

        try:
            dt = datetime(annee, mois, jour, heure, minute)
            matches.append(dt)
        except ValueError:
            continue
        
    nbr_dt = len(matches)
        
    if nbr_dt == 0:
        result = None
    elif nbr_dt == 1:
        result = matches[0]
    else:
        dates_futures = [
                    dt for dt in matches
                    if dt >= datetime.now()
                ]
        if len(dates_futures) == 0:
            result = max([dt for dt in matches], default=None)
        else:
            result = min(dates_futures, default=None)
        
    if not result is None:
        clean_result = result
    else:
        clean_result = None

    return clean_result


#COMPUTATIONS

def compute_surface(lots_container):
    
    tot_surface = 0
    
    sous_lots = lots_container.select(".SousLot")

    for sous_lot in sous_lots:
    
        text = sous_lot.get_text(" ", strip=True)
    
        matches = re.findall(
            r"\bde\s+([\d\s]+(?:[,.]\d+)?)\s*m²",
            text,
            flags=re.IGNORECASE
        )
    
        for surface_text in matches:
            surface_text = surface_text.replace(" ", "")
            surface_text = surface_text.replace(",", ".")
            
            tot_surface += float(surface_text)
            
    if tot_surface == 0:
        tot_surface = None
        
    return tot_surface

def resell_thresh(sell_dt, day_del = 10):
    
    thresh_dt = sell_dt.date() + timedelta(days=10)
    
    if sell_dt > datetime.now():
        
        #BIEN NON VENDU
        state_bl = 0
        
    else:
        
        #BIEN DEJA VENDU
        
        if datetime.now().date() > thresh_dt:
            #PAS DE SURENCHRE
            state_bl = -1
        else:
            state_bl = 1
        
        #print("\nBien Deja Vendu", f"Date de Vente: {sell_dt}", f"Date Actuel: {datetime.now()}", sep = "\n", end = "\n")
    
    return [thresh_dt, state_bl]

def estimated_price(stats):
    
    if (not stats is None):
        est_price = int(float(stats["avg"]))
    else:
        est_price = None
    
    return est_price


# METIERS

def build_urls(method, struct_url, geo_zones, biens_categs):
    
    """ CONSTRUCTION LISTE URLS POUR VENTES """
    
    if method == "VENTE":
        add_str = ".html?type=H"
        
    urls = []
    
    for zone in geo_zones:
        
        if method == "VENTE":
        
            for categ in biens_categs:
                
                url = "/".join([struct_url, zone, categ]) + add_str
                urls.append(url)
                
        elif method == "VISITE":
            
            url = "/".join([struct_url, zone, "prochaines-ventes.html"])
            urls.append(url)
            
    return urls

def keep_next_selling(past_dict):
    
    """ CONSERVER ANNONCES TANT QUE VENTE PAS REALISE """
    
    now_date = datetime.date(datetime.now())
    out_dict = {}
    
    for ann_id in past_dict.keys():
        
        bien = past_dict[ann_id]

        dt_vente = datetime.strptime(bien["dt_vente"], "%Y-%m-%d %H:%M").date()
        
        try:
            visite_dt = datetime.strptime(bien["visite_dt"], "%Y-%m-%d %H:%M").date()
        except:
            visite_dt = datetime.date(datetime.now()) - timedelta(days=1)
        
        if (now_date > visite_dt) and (now_date <= dt_vente):
            bien["visite_dt"] = ""
            out_dict[ann_id] = bien
    
    return out_dict


#SOUP

def build_soup_session():
    
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/131.0 Safari/537.36"
        ),
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }
    
    session = requests.Session()
    session.headers.update(HEADERS)
    
    return session

def get_soup(session, url, 
             parser = "lxml",
             request_timeout = 30):
    """Télécharge une page et retourne BeautifulSoup."""

    response = session.get(
        url,
        timeout=request_timeout,
    )

    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        parser,
    )

def get_page_text(soup):
    """
    Retourne le texte principal de la page.

    On enlève les éléments qui polluent l'analyse.
    """

    for element in soup([
        "script",
        "style",
        "noscript",
    ]):
        element.decompose()

    return soup.get_text(
        "\n",
        strip=True,
    )

def get_max_date(soup, scrap_mode):
    
    """
    #TEST
    session = build_soup_session()
    url = r"https://www.licitor.com/ventes-aux-encheres-immobilieres/paris-et-ile-de-france/appartement.html?type=H&p=6"
    soup = get_soup(session, url)    
    scrap_mode = "VENTE"
    """
    
    """
    DESACTIVER CAR REPOSE SUR SCRAPPING VIA CALENDRIER DES ANNONCES (ANCIENNE METHODE)
    if scrap_mode == "VISITE":
        obj = soup.find("p", attrs={"class": "VisitDate First"}).find("span", attrs = {"class": "Day"})
        raw = obj.get_text(" ", strip = True).split(" ")[1]
        raw_dt = "-".join([raw, str(datetime.now().year)])
        out = datetime.strptime(raw_dt, "%d-%m-%Y").date()
    """
    
    if scrap_mode == "VENTE":
        obj = soup.find("ul", attrs={"class": "AdResults"}).find("li").find("p", attrs = {"class": "Result"})
        raw_dt = obj.get_text(" ", strip = True).split(":")[0].strip()
        out = datetime.strptime(raw_dt, "%d-%m-%Y")
    else:
        return None
        
    return out