# -*- coding: utf-8 -*-
"""
Created on Wed Oct  7 12:42:38 2026

@author: benja
"""

import requests
import pandas as pd
from pathlib import Path
import unicodedata
import re
import math

BAN_REVERSE_URL = "https://data.geopf.fr/geocodage/reverse"

BASE_DEPARTEMENTS = {
    "Ain": [46.0655, 5.2848],
    "Aisne": [49.4533, 3.6069],
    "Allier": [46.3675, 3.1639],
    "Alpes-de-Haute-Provence": [44.1641, 6.1879],
    "Hautes-Alpes": [44.6565, 6.3520],
    "Alpes-Maritimes": [43.9211, 7.1791],
    "Ardèche": [44.8152, 4.3987],
    "Ardennes": [49.6980, 4.6716],
    "Ariège": [42.9455, 1.4066],
    "Aube": [48.3202, 4.1905],
    "Aude": [43.0543, 2.5125],
    "Aveyron": [44.3159, 2.5066],
    "Bouches-du-Rhône": [43.5424, 5.0343],
    "Calvados": [49.0908, -0.2414],
    "Cantal": [45.0498, 2.6997],
    "Charente": [45.6668, 0.0973],
    "Charente-Maritime": [45.7302, -0.7213],
    "Cher": [47.0249, 2.5753],
    "Corrèze": [45.3429, 1.8176],
    "Corse-du-Sud": [41.8734, 9.0087],
    "Haute-Corse": [42.4220, 9.1009],
    "Côte-d'Or": [47.4655, 4.7481],
    "Côtes-d'Armor": [48.4584, -2.7506],
    "Creuse": [46.0593, 2.0489],
    "Dordogne": [45.1429, 0.6321],
    "Doubs": [47.0670, 6.2356],
    "Drôme": [44.7296, 5.2046],
    "Eure": [49.0756, 0.9652],
    "Eure-et-Loir": [48.4474, 1.3999],
    "Finistère": [48.2453, -4.0440],
    "Gard": [43.9600, 4.2976],
    "Haute-Garonne": [43.3055, 0.9717],
    "Gers": [43.6955, 0.4101],
    "Gironde": [44.8837, -0.6051],
    "Hérault": [43.5914, 3.3553],
    "Ille-et-Vilaine": [48.1728, -1.6498],
    "Indre": [46.8121, 1.5382],
    "Indre-et-Loire": [47.2232, 0.6867],
    "Isère": [45.2898, 5.6344],
    "Jura": [46.7834, 5.7833],
    "Landes": [44.0100, -0.6434],
    "Loir-et-Cher": [47.6598, 1.2972],
    "Loire": [45.7539, 4.0455],
    "Haute-Loire": [45.0857, 3.8338],
    "Loire-Atlantique": [47.3482, -1.8727],
    "Loiret": [47.9140, 2.3074],
    "Lot": [44.6250, 1.6658],
    "Lot-et-Garonne": [44.3692, 0.4539],
    "Lozère": [44.5426, 3.5211],
    "Maine-et-Loire": [47.3886, -0.3909],
    "Manche": [49.0919, -1.2454],
    "Marne": [48.9613, 4.3122],
    "Haute-Marne": [48.1329, 5.2529],
    "Mayenne": [48.1508, -0.6491],
    "Meurthe-et-Moselle": [48.9560, 5.9870],
    "Meuse": [49.0130, 5.4287],
    "Morbihan": [47.8260, -2.7633],
    "Moselle": [49.0207, 6.5380],
    "Nièvre": [47.1197, 3.5449],
    "Nord": [50.5290, 3.0884],
    "Oise": [49.4121, 2.4065],
    "Orne": [48.5761, 0.0447],
    "Pas-de-Calais": [50.5144, 2.2580],
    "Puy-de-Dôme": [45.7715, 3.0840],
    "Pyrénées-Atlantiques": [43.1872, -0.7282],
    "Hautes-Pyrénées": [43.1438, 0.1587],
    "Pyrénées-Orientales": [42.6259, 2.5065],
    "Bas-Rhin": [48.5992, 7.5338],
    "Haut-Rhin": [47.8655, 7.2315],
    "Rhône": [45.8802, 4.5645],
    "Haute-Saône": [47.6384, 6.0951],
    "Saône-et-Loire": [46.6557, 4.5586],
    "Sarthe": [48.0269, 0.2538],
    "Savoie": [45.4949, 6.3847],
    "Haute-Savoie": [46.0688, 6.3445],
    "Paris": [48.8567, 2.3515],
    "Seine-Maritime": [49.6632, 0.9401],
    "Seine-et-Marne": [48.6190, 3.0418],
    "Yvelines": [48.7620, 1.8871],
    "Deux-Sèvres": [46.5391, -0.2995],
    "Somme": [49.9690, 2.3739],
    "Tarn": [43.7922, 2.1340],
    "Tarn-et-Garonne": [44.0807, 1.2051],
    "Var": [43.4174, 6.2665],
    "Vaucluse": [43.9939, 5.1819],
    "Vendée": [46.6758, -1.2914],
    "Vienne": [46.6121, 0.4654],
    "Haute-Vienne": [45.9190, 1.2032],
    "Vosges": [48.1638, 6.3821],
    "Yonne": [47.8551, 3.6450],
    "Territoire de Belfort": [47.6292, 6.8993],
    "Essonne": [48.5303, 2.2393],
    "Hauts-de-Seine": [48.8402, 2.1986],
    "Seine-Saint-Denis": [48.9098, 2.4529],
    "Val-de-Marne": [48.7745, 2.4543],
    "Val-d'Oise": [49.0751, 2.2098]
}


DEPARTEMENTS = {
    
    'ain': [46.0655, 5.2848],
    'aisne': [49.4533, 3.6069],
    'allier': [46.3675, 3.1639],
    'alpes_de_haute_provence': [44.1641, 6.1879],
    'hautes_alpes': [44.6565, 6.352],
    'alpes_maritimes': [43.9211, 7.1791],
    'ardeche': [44.8152, 4.3987],
    'ardennes': [49.698, 4.6716],
    'ariege': [42.9455, 1.4066],
    'aube': [48.3202, 4.1905],
    'aude': [43.0543, 2.5125],
    'aveyron': [44.3159, 2.5066],
    'bouches_du_rhone': [43.5424, 5.0343],
    'calvados': [49.0908, -0.2414],
    'cantal': [45.0498, 2.6997],
    'charente': [45.6668, 0.0973],
    'charente_maritime': [45.7302, -0.7213],
    'cher': [47.0249, 2.5753],
    'correze': [45.3429, 1.8176],
    'corse_du_sud': [41.8734, 9.0087],
    'haute_corse': [42.422, 9.1009],
    'cote_d_or': [47.4655, 4.7481],
    'cotes_d_armor': [48.4584, -2.7506],
    'creuse': [46.0593, 2.0489],
    'dordogne': [45.1429, 0.6321],
    'doubs': [47.067, 6.2356],
    'drome': [44.7296, 5.2046],
    'eure': [49.0756, 0.9652],
    'eure_et_loir': [48.4474, 1.3999],
    'finistere': [48.2453, -4.044],
    'gard': [43.96, 4.2976],
    'haute_garonne': [43.3055, 0.9717],
    'gers': [43.6955, 0.4101],
    'gironde': [44.8837, -0.6051],
    'herault': [43.5914, 3.3553],
    'ille_et_vilaine': [48.1728, -1.6498],
    'indre': [46.8121, 1.5382],
    'indre_et_loire': [47.2232, 0.6867],
    'isere': [45.2898, 5.6344],
    'jura': [46.7834, 5.7833],
    'landes': [44.01, -0.6434],
    'loir_et_cher': [47.6598, 1.2972],
    'loire': [45.7539, 4.0455],
    'haute_loire': [45.0857, 3.8338],
    'loire_atlantique': [47.3482, -1.8727],
    'loiret': [47.914, 2.3074],
    'lot': [44.625, 1.6658],
    'lot_et_garonne': [44.3692, 0.4539],
    'lozere': [44.5426, 3.5211],
    'maine_et_loire': [47.3886, -0.3909],
    'manche': [49.0919, -1.2454],
    'marne': [48.9613, 4.3122],
    'haute_marne': [48.1329, 5.2529],
    'mayenne': [48.1508, -0.6491],
    'meurthe_et_moselle': [48.956, 5.987],
    'meuse': [49.013, 5.4287],
    'morbihan': [47.826, -2.7633],
    'moselle': [49.0207, 6.538],
    'nievre': [47.1197, 3.5449],
    'nord': [50.529, 3.0884],
    'oise': [49.4121, 2.4065],
    'orne': [48.5761, 0.0447],
    'pas_de_calais': [50.5144, 2.258],
    'puy_de_dome': [45.7715, 3.084],
    'pyrenees_atlantiques': [43.1872, -0.7282],
    'hautes_pyrenees': [43.1438, 0.1587],
    'pyrenees_orientales': [42.6259, 2.5065],
    'bas_rhin': [48.5992, 7.5338],
    'haut_rhin': [47.8655, 7.2315],
    'rhone': [45.8802, 4.5645],
    'haute_saone': [47.6384, 6.0951],
    'saone_et_loire': [46.6557, 4.5586],
    'sarthe': [48.0269, 0.2538],
    'savoie': [45.4949, 6.3847],
    'haute_savoie': [46.0688, 6.3445],
    'paris': [48.8567, 2.3515],
    'seine_maritime': [49.6632, 0.9401],
    'seine_et_marne': [48.619, 3.0418],
    'yvelines': [48.762, 1.8871],
    'deux_sevres': [46.5391, -0.2995],
    'somme': [49.969, 2.3739],
    'tarn': [43.7922, 2.134],
    'tarn_et_garonne': [44.0807, 1.2051],
    'var': [43.4174, 6.2665],
    'vaucluse': [43.9939, 5.1819],
    'vendee': [46.6758, -1.2914],
    'vienne': [46.6121, 0.4654],
    'haute_vienne': [45.919, 1.2032],
    'vosges': [48.1638, 6.3821],
    'yonne': [47.8551, 3.645],
    'territoire_de_belfort': [47.6292, 6.8993],
    'essonne': [48.5303, 2.2393],
    'hauts_de_seine': [48.8402, 2.1986],
    'seine_saint_denis': [48.9098, 2.4529],
    'val_de_marne': [48.7745, 2.4543],
    'val_d_oise': [49.0751, 2.2098]
    
    }

ANOM_THRESH = 300

def normalize_string(text):
    """
    Normalise une chaîne :
    - minuscules
    - suppression des accents
    - suppression des caractères spéciaux
    - remplacement des espaces par '_'
    - suppression des espaces en début/fin
    """

    # Conversion en chaîne et minuscules
    text = str(text).lower().strip()

    # Suppression des accents
    text = unicodedata.normalize("NFD", text)
    text = "".join(
        char for char in text
        if unicodedata.category(char) != "Mn"
    )

    # Remplacement de tout ce qui n'est pas lettre/chiffre
    # par un espace
    text = re.sub(r"[^a-z0-9]+", " ", text)

    # Nettoyage des espaces multiples
    text = re.sub(r"\s+", " ", text).strip()

    # Remplacement des espaces par _
    text = text.replace(" ", "_")

    return text

def compute_distance(c1, c2):
    
    lat1 = c1[0]
    lon1 = c1[1]
    lat2 = c2[0]
    lon2 = c2[1]

    # Conversion en radians
    lat1, lon1, lat2, lon2 = map(
        math.radians,
        [lat1, lon1, lat2, lon2]
    )

    # Formule de Haversine
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Rayon moyen de la Terre en kilomètres
    rayon_terre = 6371

    return rayon_terre * c

def get_dep_from_trib(tribunal_name):
    
    if "(" in tribunal_name:
        raw = tribunal_name.split("(")[1].replace(")", "")
    else:
        return ""
    
    clean_dep = normalize_string(raw)
    
    return clean_dep

def tribunal_anom(dep_bien, tribunal_vente):
    
    #EXTRAIRE DEPARTEMENT DU NOM DU TRIBUNAL
    trib_dep = get_dep_from_trib(tribunal_vente)
    
    if trib_dep == "":
        return False
    
    clean_dep = normalize_string(dep_bien)
    
    valid_keys = (trib_dep in DEPARTEMENTS) and (clean_dep in DEPARTEMENTS)
    
    if not valid_keys:
        return valid_keys
    
    c1 = DEPARTEMENTS[trib_dep]
    c2 = DEPARTEMENTS[clean_dep]
    
    distance = compute_distance(c1, c2)
    
    return (distance >= ANOM_THRESH)
    

def reverse_geocode(latitude, longitude):
    """
    Récupère les informations administratives à partir
    des coordonnées GPS.
    """
    
    """
    latitude = 43.6103431996,
    longitude =  -1.04133365689
    """
    
    if latitude is None or longitude is None:
        return None

    params = {
        "lon": longitude,
        "lat": latitude,
    }

    try:
        response = requests.get(
            BAN_REVERSE_URL,
            params=params,
            timeout=10
        )

        response.raise_for_status()

    except requests.RequestException as e:
        print(
            f"Erreur géocodage "
            f"{latitude}, {longitude} : {e}"
        )
        return None

    data = response.json()

    features = data.get("features", [])

    if not features:
        return None

    properties = features[0].get("properties", {})
    
    out = {
            "code_postal": properties.get("postcode"),
            "code_insee": properties.get("citycode"),
            "commune": properties.get("city"),
        }

    return out

    
def build_geo_dicts(file_path):

    communes = pd.read_csv(
        file_path,
    )
    
    clean_comm = communes.drop_duplicates(subset =["code_commune_INSEE"]).copy()
    clean_comm["norm_nom_commune"] = clean_comm["nom_commune_complet"].apply(normalize_string)
    
    clean_noms = clean_comm.drop_duplicates(subset =["norm_nom_commune"]).copy()

    codes_dict = (
        clean_comm
        .set_index("code_commune_INSEE")
        .to_dict("index")
    )
    
    noms_dict = (
        clean_noms
        .set_index("norm_nom_commune")
        .to_dict("index")
    )
    
    return [codes_dict, noms_dict]

def enrich_handler(scrapper_results):
    
    #loc_dir = Path(r"C:/Users/benja/Documents/licitor_app/")
    
    try:
        BASE_DIR = Path(__file__).resolve().parents[2]
    except NameError:
        BASE_DIR = Path.cwd() / "Documents" / "licitor_app"
        
    file_path = BASE_DIR / "data" / "comm_data.csv"
    
    dicts_out = build_geo_dicts(file_path)
    codes_dict = dicts_out[0]
    noms_dict = dicts_out[1]
    
    clean_annonces = {}
    
    for id_bien in scrapper_results:
        past_annonce = scrapper_results[id_bien]
        new_annonce = enrich_annonce(past_annonce, codes_dict, noms_dict)
        clean_annonces[id_bien] = new_annonce
        
    return clean_annonces
    
def enrich_annonce(
    annonce,
    codes_dict,
    noms_dict
):
    the_id = annonce["id"]
    
    #print(f"Enrichissement annonce --  {the_id}: {annonce}")
    
    #INITIALIZE
    
    code_insee = None
    cp = None
    code_dep = None
    code_reg = None
    dep_lib = None
    reg_lib = None
    idf_in_oth = None
    
    annonce["code_insee"] = code_insee
    annonce["code_postal"] = cp
    annonce["code_departement"] = code_dep
    annonce["code_region"] = code_reg
    annonce["nom_departement"] = dep_lib
    annonce["nom_region"] = reg_lib
    
    ann_coords = annonce["coords"]
    
    try:
        latitude = ann_coords["latitude"]
        longitude = ann_coords["longitude"]
    except:
        latitude = None
        longitude = None
        
    geo = reverse_geocode(
        latitude,
        longitude
    )

    if geo:
        
        #print(f"Objet Géographique trouvé: {the_id}")
        code_insee = geo["code_insee"]
        annonce["code_insee"] = code_insee
        key = code_insee
        commune = codes_dict.get(key)
        
    else:
    
        key = normalize_string(annonce["ville"])
        commune = noms_dict.get(key)
        if not commune:
            sec_key = key.split("(")[0].strip()
            if sec_key != key:
                commune = noms_dict.get(sec_key)

    if commune:
        
        if (latitude is None or longitude is None):
            lat = commune["latitude"]
            long = commune["longitude"]
            coords_dict = {}
            coords_dict["latitude"] = float(lat)
            coords_dict["longitude"] = float(long)
            annonce["coords"] = coords_dict

        cp = commune["code_postal"]
        code_dep = commune["code_departement"]
        code_reg = commune["code_region"]
        dep_lib = commune["nom_departement"]
        reg_lib = commune["nom_region"]
        
        annonce["code_postal"] = cp
        annonce["code_departement"] = code_dep
        annonce["code_region"] = code_reg
        annonce["nom_departement"] = dep_lib
        annonce["nom_region"] = reg_lib
        
        annonce["trib_anom"] = tribunal_anom(annonce["nom_departement"], annonce["tribunal"])
        
    return annonce
