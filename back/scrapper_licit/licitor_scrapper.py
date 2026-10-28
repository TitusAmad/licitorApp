import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from datetime import timedelta
from collections import Counter

from back.geo_infos.geo_data import enrich_handler


def clean_text(value):
    """Nettoie les espaces et retours à la ligne."""

    if not value:
        return None

    value = value.replace("\xa0", " ")

    return re.sub(r"\s+", " ", value).strip()


def handle_prices(lot, price):
    
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


def get_soup(session, url):
    """Télécharge une page et retourne BeautifulSoup."""

    response = session.get(
        url,
        timeout=30,
    )

    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        "lxml",
    )


def extract_announcement_urls(session,
                              request_delay,
                              base_url, search_url, 
                              max_pages=None, max_announces = None, 
                              max_pub_dt = None, max_vis_dt = None):
    
    
    """
    TEST
    search_url = SEARCH_URL
    max_pages = MAX_PAGES
    max_dt = None
    """
    
    """
    Récupère les URLs de toutes les annonces sur plusieurs pages.
    
    Exemple :
        page 1 : .../prochaines-ventes.html
        page 2 : .../prochaines-ventes.html?p=2
        page 3 : .../prochaines-ventes.html?p=3
    
    La récupération s'arrête lorsqu'une page ne contient
    plus aucune annonce.
    
    max_pages permet éventuellement de limiter le nombre
    de pages parcourues pendant les tests.
    """
    
    urls = []
    page = 1
    
    while True:
    
        # -----------------------------------------------------
        # CONSTRUCTION DE L'URL DE LA PAGE
        # -----------------------------------------------------
    
        if page == 1:
            page_url = search_url
        else:
            page_url = f"{search_url}?p={page}"
    
        print(
            f"\nRecherche des annonces - page {page}"
        )
        print(
            f"  → {page_url}"
        )
    
        try:
            soup = get_soup(session, page_url)
    
        except requests.RequestException as error:
    
            print(
                f"  ⚠️ Erreur lors du chargement de la page : {error}"
            )
    
            break
    
        # -----------------------------------------------------
        # RÉCUPÉRATION DES URLS
        # -----------------------------------------------------
        
        #A ADAPTER POUR PERMETTRE UN STOP SUR LES DATES DE VISITE
    
        page_urls = []
    
        for link in soup.find_all(
            "a",
            href=True,
        ):
    
            href = link["href"]
    
            absolute_url = urljoin(
                base_url,
                href,
            )
    
            parsed = urlparse(
                absolute_url
            )
    
            # Une annonce Licitor contient /annonce/
            if "/annonce/" not in parsed.path:
                continue
                
            # Évite les doublons sur la page.
            if absolute_url not in page_urls:
                
                try:
                    page_soup = get_soup(session, absolute_url)
            
                except requests.RequestException as error:
            
                    print(
                        f"  ⚠️ Erreur lors du chargement de l'annonce sur la page ({page}) : {error}"
                    )
                    print(
                        f"Annonce: {absolute_url}")
            
                    pass
                
                #Date treshing
                
                if max_pub_dt is None:
                    max_pub_dt = datetime(1900,1,1).date()
                if max_vis_dt is None:
                    max_vis_dt = datetime(1900,1,1).date()

                ad = page_soup.select_one(".AdContent")
                publication = ad.select_one(".PublishingDate time")
                
                if publication:
                    ann_dt_str = publication.get("datetime")[0:10]
                    annonce_dt = datetime.strptime(ann_dt_str, "%Y-%m-%d").date()
                    end_bl = (annonce_dt < max_pub_dt)
                    if end_bl:
                        break
                
                page_urls.append(
                    absolute_url
                )
                
                #AJOUTER LA LOGIQUE POUR VISITE
                #XXX

    
        # -----------------------------------------------------
        # FIN DE LA PAGINATION
        # -----------------------------------------------------
    
        if not page_urls:
    
            print(
                f"  → Aucune annonce trouvée sur la page {page}."
            )
    
            break
    
        # -----------------------------------------------------
        # AJOUT DES URLS
        # -----------------------------------------------------
    
        new_urls = 0
    
        for url in page_urls:
    
            if url not in urls:
    
                urls.append(url)
    
                new_urls += 1
    
        print(
            f"  → {len(page_urls)} annonces trouvées "
            f"({new_urls} nouvelles)"
        )
    
        # -----------------------------------------------------
        # LIMITE OPTIONNELLE DU NOMBRE DE PAGES
        # -----------------------------------------------------
    
        if max_pages is not None and page >= max_pages:
    
            print(
                f"\nLimite de {max_pages} page(s) atteinte."
            )
    
            break
        
        # -----------------------------------------------------
        # LIMITE OPTIONNELLE DU NOMBRE D'ANNONCES
        # -----------------------------------------------------
        
        nbr_announces = len(urls)
    
        if max_announces is not None and nbr_announces >= max_announces:
    
            print(
                f"\Limite de {max_announces} annonce(s) atteinte."
            )
    
            break
        
        # -----------------------------------------------------
        # FIN SCRAPPING - MAX DATE ATTEINT
        # -----------------------------------------------------
        
        if end_bl:
            print(
                f"\n→ Date max de scrappîng atteinte ({max_pub_dt}) pour l'annonce publiée le {annonce_dt}."
            )
            break
    
    
        page += 1
    
        # Pause entre les pages de recherche.
        time.sleep(request_delay)
    
    return urls


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

    patterns = [
        r"\bLes biens sont occupés\b",
        r"\bBien occupé\b",
        r"\bBien loué\b",
        r"\bLoué\b",
        r"\bLibre\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        if match:
            return match.group(0)

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
    
    if sell_dt >= datetime.now():

        if datetime.now().date() > thresh_dt:
            state_bl = -1
        else:
            state_bl = 1
            
    else:
        
        state_bl = 0
    
    return [thresh_dt, state_bl]

def estimated_price(stats):
    
    if (not stats is None):
        est_price = int(float(stats["avg"]))
    else:
        est_price = None
    
    return est_price


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


def validate_announcement(data):
    """
    Vérifie la présence des champs importants.
    Retourne une liste de warnings.
    """

    warnings = []
    
    #GLOBALE

    if not data["date_publication"]:
        warnings.append("date_publication manquante")

    if not data["tribunal"]:
        warnings.append("tribunal manquant")

    if not data["type_vente"]:
        warnings.append("type_vente manquant")

    if not data["dt_vente"]:
        warnings.append("dt_vente manquante")
        
    if not data["avocats"]:
        warnings.append("avocat manquant")
        
    #PAR BIEN
        
    if not data["id"]:
        warnings.append("id manquant")

    if data["mise_a_prix"] is None:
        warnings.append("mise_a_prix manquante")

    if not data["ville"]:
        warnings.append("ville manquante")

    if not data["adresse"]:
        warnings.append("adresse manquante")
        
    if not data["coords"]:
        warnings.append("coordonnées géographiques manquantes")
        
    if not data["visite"]:
        warnings.append("visite manquant")

    return warnings


def parse_announcement(session, url, debug_path):
    
    print(f"  → {url}")
    
    soup = get_soup(session, url)
    
    # ---------------------------------------------------------
    # PAGE
    # ---------------------------------------------------------
    
    # ---------------------------------------------------------
    # TITRE PAGE
    # ---------------------------------------------------------
    
    page_title = None
    
    title = soup.select_one("#legalad-search h1")

    if title:
        page_title = clean_text(
            title.get_text(" ", strip=True)
            )
        
    
    # ---------------------------------------------------------
    # STATS IMMO PAGE
    # ---------------------------------------------------------
    
    partnerData = soup.select_one(".PartnerOffer")

    # ---------------------------------------------------------
    # CONTENEUR PRINCIPAL DE L'ANNONCE
    # ---------------------------------------------------------

    ad = soup.select_one(".AdContent")

    if not ad:
        print("    ⚠️ Conteneur .AdContent introuvable")
        return None
    
    # ---------------------------------------------------------
    # VARIABLES COMMUNES
    # ---------------------------------------------------------
    
    # ---------------------------------------------------------
    # ID
    # ---------------------------------------------------------

    number = ad.select_one(".Number")
        
    # ---------------------------------------------------------
    # DATE DE PUBLICATION
    # ---------------------------------------------------------

    page_pub = None
    
    publication = ad.select_one(".PublishingDate time")

    if publication:
        page_pub = publication.get("datetime")
        
    # ---------------------------------------------------------
    # TRIBUNAL
    # ---------------------------------------------------------

    page_tribunal = None
    
    court = ad.select_one(".Court")

    if court:
        page_tribunal = clean_text(
            court.get_text(" ", strip=True)
        )

    # ---------------------------------------------------------
    # TYPE DE VENTE
    # ---------------------------------------------------------

    page_type_vente = None
    
    sale_type = ad.select_one(".Type")

    if sale_type:
        page_type_vente = clean_text(
            sale_type.get_text(" ", strip=True)
        )

    # ---------------------------------------------------------
    # DATE / HEURE DE VENTE
    # ---------------------------------------------------------

    page_dt_vente = None
    page_dt_limit = None
    
    page_dt_vente_str = None
    page_dt_limit_str = None
    
    #-1 si vendu et délai 10jours passé ; 1 si vendu mais délai pas passé ; 0 si pas vendu
    sell_state = None
    
    sale_date = ad.select_one(".Date time")

    if sale_date:

        datetime_value = sale_date.get("datetime")

        if datetime_value:

            try:
                dt = datetime.fromisoformat(
                    datetime_value
                )
                
                limit_out = resell_thresh(dt)
                
                page_dt_limit = limit_out[0]
                page_dt_limit_str = page_dt_limit.isoformat()
                
                sell_state = limit_out[1]

                date_vente = dt.date().isoformat()
                heure_vente = dt.strftime("%H:%M")
                
                page_dt_vente = dt
                page_dt_vente_str = date_vente + " " + heure_vente

            except ValueError:
                # Si jamais le format change,
                # on conserve le texte visible.
                page_dt_vente_str = clean_text(
                    sale_date.get_text(" ", strip=True)
                )

        else:
            page_dt_vente_str = clean_text(
                sale_date.get_text(" ", strip=True)
            )
            
            
    # ---------------------------------------------------------
    # AVOCAT / TÉLÉPHONE
    # ---------------------------------------------------------
    
    lawyers = []
    phones = []

    trusts = ad.find_all("div", attrs={"class":"Trust"})
    
    if trusts:
        
        for trust in trusts:

            lawyer = trust.select_one("h3")
    
            if lawyer:
                lawyer_desc = clean_text(
                    lawyer.get_text(" ", strip=True)
                )
                lawyers.append(lawyer_desc)
    
            trust_text = clean_text(
                trust.get_text(" ", strip=True)
            )
    
            phone_match = re.search(
                r"Tél\.\s*:\s*([0-9 .]+)",
                trust_text,
                flags=re.IGNORECASE,
            )
    
            if phone_match:
                lawyer_phone = clean_text(
                    phone_match.group(1)
                )
                phones.append(lawyer_phone)


    # ---------------------------------------------------------
    # DOCUMENTS
    # ---------------------------------------------------------
    
    page_docs = []

    related = ad.select_one(".Related")

    if related:

        for link in related.select("a"):

            document_type = clean_text(
                link.get_text(" ", strip=True)
            )

            document_url = link.get("href")

            if document_type and document_url:

                page_docs.append({
                    "type": document_type,
                    "url": document_url,
                })
                
    
    # ---------------------------------------------------------
    # BOUCLE MULTI ANNONCES
    # ---------------------------------------------------------
    
    mult_ann = ad.find_all("section", attrs={"class": "AddressBlock"})
    
    all_data = []
    
    lot_count = 0
    
    for i in range(len(mult_ann)):

        block = mult_ann[i]
        
        #VARIABLES LIEES A UNE ADRESSE D'UN BIEN
    
        # ---------------------------------------------------------
        # STATS PRIX
        # ---------------------------------------------------------
            
        partner_stats = None

        if partnerData and i == 0:
            
            partner_stats = extract_partner_stats(partnerData)
        
        # ---------------------------------------------------------
        # LOCALISATION
        # ---------------------------------------------------------
    
        ville_bien = None
        adr_bien = None
        cords_bien = {}
        visite_bien = None
        visite_dt = None
        visite_dt_str = None
        visite_bl = None
            
        location = block.select_one(".Location")
    
        if location:
    
            # -----------------------------------------------------
            # VILLE
            # -----------------------------------------------------
            
            city = location.select_one(".City")
    
            if city:
                ville_bien = clean_text(
                    city.get_text(" ", strip=True)
                )
    
            # -----------------------------------------------------
            # ADRESSE
            # -----------------------------------------------------
            
            street = location.select_one(".Street")
    
            if street:
    
                street_text = clean_text(
                    street.get_text(" ", strip=True)
                )
    
                if street_text:
                    adr_bien = street_text
                    
            # -----------------------------------------------------
            # COORDONNEES GEOGRAPHIQUES
            # -----------------------------------------------------
    
            mapp = location.select_one(".Map")
    
            if mapp:
    
                maps_ref = mapp.find("a",{"class":"Button"}).get("href")
    
                if maps_ref:
                    cords_bien = extract_coordinates(maps_ref)
            
            # -----------------------------------------------------
            # VISITE
            # -----------------------------------------------------
            
            visit = location.select_one(".Visits")
    
            if visit:
                visite_bien = clean_text(
                    visit.get_text(" ", strip=True)
                )
                visite_dt = parse_visite_dt(visite_bien)
                
                if visite_dt is None:
                    visite_bl = -1
                else:
                    visite_dt_str = visite_dt.strftime("%Y-%m-%d %H:%M")
                    if visite_dt >= datetime.now():
                        visite_bl = 1
                    else:
                        visite_bl = 0
            
            else:
                visite_bl = -1
                
                
        #BOUCLE MULTI LOTS SUR UN MEME BIEN

        lots = block.find_all("div", attrs={"class": "Lot"})
        
        for lot in lots: 
            
            lot_count +=1
        
            # ---------------------------------------------------------
            # ADJUST -- ID
            # ---------------------------------------------------------
        
            clean_id = None
        
            if number:
                raw_id = clean_text(
                    number.get_text(" ", strip=True)
                )
                
                id_indx = lot_count - 1
                if id_indx > 0:
                    clean_id = raw_id + f"_{id_indx}"
                else:
                    clean_id = raw_id
            
            # ---------------------------------------------------------
            # MISE À PRIX
            # ---------------------------------------------------------
        
            prix_depart = None
            prix_final = None
            
            price = lot.select_one("h3")
        
            if price:
                prices = handle_prices(lot, price)
                
                mise_obj = prices[0]
                vente_obj = prices[1]
                
                if mise_obj:
                    prix_depart = extract_money(
                        mise_obj.get_text(" ", strip=True)
                    )
                
                if vente_obj:
                    prix_final = extract_money(
                        vente_obj.get_text(" ", strip=True)
                    )
        
            
            # ---------------------------------------------------------
            # FACULTE DE BAISSE
            # ---------------------------------------------------------
        
            baisse_bien = None
            
            addText = lot.find("p", attrs={"class":"AdditionalText"})
        
            if addText:
                raw_txt = str(addText)
                baisse_bien = ("baisse de la mise" in raw_txt)
            

            # ---------------------------------------------------------
            # COMPOSITION DU BIEN
            # ---------------------------------------------------------
            
            types_bien = []
            desc_bien = []
            occupation_bien = None
            surface_bien = None
            
            # -----------------------------------------------------
            # TYPE DU BIEN
            # -----------------------------------------------------
            
            types_bien = extract_type(lot)
            
            # -----------------------------------------------------
            # DESCRIPTION
            # -----------------------------------------------------
            
            desc_bien = extract_description(lot)
            
            # -----------------------------------------------------
            # OCCUPATION
            # -----------------------------------------------------
            
            occupation_bien = extract_occupation(lot)
    
            # -----------------------------------------------------
            # SURFACE
            # -----------------------------------------------------
            
            surface_bien = compute_surface(lot)
            
            #PRIX ESTIME
            
            prix_est = None
            
            if prix_depart:
                prix_est = estimated_price(partner_stats)
        
            # ---------------------------------------------------------
            # AFFECTATION VALEURS
            # --------------------------------------------------------      
            
            data = {
                
                #VARIABLES COMMUNES (MULTI BIENS)
                
                "titre": None,
                "date_publication": None,
                
                "tribunal": None,
                "type_vente": None,
                "dt_vente": None,
                "dt_vente_limit": None,
                "sell_state": None,
                
                "avocats": [],
                "telephones": [],
                "documents": [],
                
                #VARIABLES BIEN
                
                "url": None,
                "id": None,
                
                "mise_a_prix": None,
                "est_price": None,
                "fac_baisse": None,
                "prix_final": None,
                "ville": None,
                "adresse": [],
                "coords": None,
                #calc dans geo
                "trib_anom": None,
                "visite": None,
                "visite_dt": None,
                "visite_state": None,
                
                "type": [],
                "description": [],
                "occupation": None,
                "surface_m2": None,
                
                "stats_bien": None
        
            }
            
            data["titre"] = page_title
            data["date_publication"] = page_pub
            data["tribunal"] = page_tribunal
            data["type_vente"] = page_type_vente
            
            data["dt_vente"] = page_dt_vente_str
            data["dt_vente_limit"] = page_dt_limit_str
            
            data["sell_state"] = sell_state
            
            data["avocats"] = lawyers
            data["telephones"] = phones
            data["documents"] = page_docs
            
            data["url"] = url
            data["id"] = clean_id
            
            data["mise_a_prix"] = prix_depart
            data["est_price_m2"] = prix_est
            data["fac_baisse"] = baisse_bien
            data["prix_final"] = prix_final
            
            data["ville"] = ville_bien
            data["adresse"] = adr_bien
            data["coords"] = cords_bien
            data["visite"] = visite_bien
            data["visite_dt"] = visite_dt_str
            data["visite_state"] = visite_bl
            
            data["type"] = types_bien
            data["description"] = desc_bien
            data["occupation"] = occupation_bien
            data["surface_m2"] = surface_bien
            
            data["stats_bien"] = partner_stats
            
            all_data.append(data)
    
            # ---------------------------------------------------------
            # DEBUG HTML
            # --------------------------------------------------------                
            #save_html(soup, debug_path, data["id"])

    
    return all_data

def save_html(soup, path, ann_id):
    
    html_file = path / f"{ann_id}.html"

    html_file.write_text(
        str(soup),
        encoding="utf-8",
    )
    
def save_output(obj, path, file_name):
    
    full_path = path / file_name
    
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

def build_warnings(clean_results):
    
    warnings = []
    
    for id_bien in clean_results:
    
        annonce = clean_results[id_bien]
        
        annonce_warnings = validate_announcement(
            annonce
        )

        if annonce_warnings:

            print(
                f"    ⚠️ {len(annonce_warnings)} warning(s)"
            )

            warnings.append({
                "url": annonce["url"],
                "id": annonce["id"],
                "warnings": annonce_warnings,
            })
        
    return warnings


def run_scrapper(past_dict,
         session,
         request_delay,
         base_url, search_url, 
         output_path, debug_path,
         max_pages = None, max_announces = None, 
         max_pub_dt = None, max_vis_dt = None):

    print("Recherche des annonces...")
    print(search_url)


    urls = extract_announcement_urls(
        session,
        request_delay,
        base_url, search_url,
        max_pages=max_pages,
        max_announces=max_announces,
        max_pub_dt = max_pub_dt,
        max_vis_dt = max_vis_dt
    )
    
    """
    urls = ["https://www.licitor.com/annonce/11/01/96/vente-aux-encheres/une-maison-principale/marnes-la-coquette/hauts-de-seine/110196.html",
            "https://www.licitor.com/annonce/11/02/06/vente-aux-encheres/un-immeuble/nevers/nievre/110206.html"]
    urls = ["https://www.licitor.com/annonce/10/97/58/vente-aux-encheres/-/paris-19eme/paris/109758.html"]
    
    
    #TEST ANNONCE AVEC ADJUDICATION DEJA PASSEE
    urls = ["https://www.licitor.com/annonce/10/96/95/vente-aux-encheres/un-appartement/vincennes/val-de-marne/109695.html"]
    
    #MULTI LOTS NON PRIS EN COMPTE -OK MAINTENANT
    urls = ["https://www.licitor.com/annonce/11/00/98/vente-aux-encheres/un-appartement/malaucene/vaucluse/110098.html"]
    
    """
    
    print(
        f"\n{len(urls)} annonces trouvées au total."
    )

    # Échantillon uniquement.
    urls = urls[:max_announces]

    print(
        f"Test sur {len(urls)} annonces."
    )

    results = {}
    errors = []
    warnings = []
    dbls = []

    for index, url in enumerate(
        urls,
        start=1,
    ):

        print(
            f"\n[{index}/{len(urls)}]"
        )

        try:
        
            annonce = parse_announcement(session, url, debug_path)
        
            if annonce:
        
                for bien in annonce:
                    id_bien = bien["id"]
                    if ((id_bien not in results) and (not id_bien is None)):
                        results[id_bien] = bien
                    else:
                        if (not id_bien is None):
                            dbls.append({
                                "url": url,
                                "id": id_bien
                                })
                            print(f"Bien déja ajouté aux résultats: {id_bien}")
                
        except requests.RequestException as error:
        
            print(
                f"Erreur HTTP : {error}"
            )
        
            errors.append({
                "url": url,
                "type": "http",
                "error": str(error),
            })
        
        except Exception as error:
        
            print(
                f"Erreur parsing : {error}"
            )
        
            errors.append({
                "url": url,
                "type": "parsing",
                "error": str(error),
            })
    
    
    
            # Respect du serveur.
            if index < len(urls):
                time.sleep(request_delay)
                
    
    ###########
    #ENRICHISSEMENT DONNEES AVEC INFOS GEO
    ###########
    
    clean_results = enrich_handler(results)
    new_els = len(clean_results)
    print(new_els, " nouveaux biens identifiés.")
    
    ###########
    #ADD OLD VISITS DATA BUT AUCTIONS NOT BE PASSED
    ###########
    
    clean_results = merge_output(clean_results, past_dict)
    final_els = len(clean_results)
    past_els = (final_els - new_els)
    print(past_els, "biens conservés pour ventes à venir.")
    
    ###########
    #WARNINGS
    ###########
    
    warnings = build_warnings(clean_results)
    
    ###########
    #SAUVEGARDE
    ###########

    save_output(clean_results, output_path, "auctions.json")
    save_output(errors, debug_path, "errors.json")
    save_output(warnings, debug_path, "warnings.json")
    save_output(dbls, debug_path, "doublons.json")    

    """
    save_json(clean_results, output_path)
    save_errors(errors, debug_path)
    save_warnings(warnings, debug_path)
    """

    print()
    print("=" * 50)
    print("RAPPORT DU SCRAPING")
    print("=" * 50)
    
    print(
        f"URLs demandées : {len(urls)}"
    )
    
    print(
        f"Annonces récupérées : {new_els}"
    )
    
    print(
        f"Erreurs : {len(errors)}"
    )
    
    print(
        f"Annonces avec warnings : {len(warnings)}"
    )
    
    print("=" * 50)
    
    return results

def keep_next_selling(past_dict):
    
    now_date = datetime.date(datetime.now())
    out_dict = {}
    
    for ann_id in past_dict.keys():
        bien = past_dict[ann_id]
        dt_vente =  datetime.strptime(bien["dt_vente"], "%Y-%m-%d %H:%M").date()
        raw_visite_dt = bien["visite_dt"]
        if raw_visite_dt == "":
            visite_dt = datetime.now().date() - timedelta(days=1)
        else:
            visite_dt  =  datetime.strptime(bien["visite_dt"], "%Y-%m-%d %H:%M").date()
        if (now_date > visite_dt) and (now_date <= dt_vente):
            bien["visite_dt"] = ""
            out_dict[ann_id] = bien
    
    return out_dict
    
def merge_output(new_dict, past_dict):
    
    past_keys = past_dict.keys()
    new_keys = new_dict.keys()
    for ann_id in past_keys:
        if (ann_id not in new_keys):
            new_dict[ann_id] = past_dict[ann_id]
    return new_dict
    

def scrapper_handler(max_pages, max_announces,
                     max_pub_dt, max_visit_dt,
                     method_key,
                     request_delay = 2.0):

    BASE_URL = "https://www.licitor.com"
    
    #POINT DENTREE SCRAPPING
    URLS_DICT = {
        
            #annonces tri en fonction des dates de publication de la plus recente à la - recente
            "annonces recentes": "https://www.licitor.com/dernieres-encheres.html",
            
            #annonces avec date de visite des plus proches au plus eloigne
            "visites a venir": "https://www.licitor.com/ventes-aux-encheres-immobilieres/visites-sur-place.html"

        }
    
    SEARCH_URL = URLS_DICT[method_key]
    
    #loc_dir = Path(r"C:/Users/benja/Documents/licitor_app/")
    
    try:
        BASE_DIR = Path(__file__).resolve().parents[2]
    except NameError:
        BASE_DIR = Path.cwd() / "Documents" / "licitor_app"
    
    OUTPUT_PATH = BASE_DIR / "front" / "data"
    DEBUG_PATH = BASE_DIR / "tests" / "scrapper_debug"
    
    #OLD DATA
    past_path = OUTPUT_PATH / "auctions.json"
    with open(past_path, "r") as file:
        past_data = json.load(file)
    clean_past = keep_next_selling(past_data)
    
    
    #NEW DATA
    
    session = build_soup_session()
    
    scrapper_out = run_scrapper(clean_past,
         session,
         request_delay,
         BASE_URL, SEARCH_URL, 
         OUTPUT_PATH, DEBUG_PATH, 
         max_pages, max_announces,
         max_pub_dt, max_visit_dt)
    
    return scrapper_out
