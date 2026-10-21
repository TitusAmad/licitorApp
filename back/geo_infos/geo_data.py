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

BAN_REVERSE_URL = "https://data.geopf.fr/geocodage/reverse"

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

def get_dep_from_trib(tribunal_name):
    
    raw = tribunal_name.split("(")[0]
    clean_dep = normalize_string(raw)
    
    return clean_dep

def tribunal_anom(dep_bien, tribunal_vente):
    
    #EXTRAIRE DEPARTEMENT DU NOM DU TRIBUNAL
    trib_dep = get_dep_from_trib(tribunal_vente)
    
    clean_dep = normalize_string(dep_bien)
    
    if trib_dep != clean_dep:
        return True
    else:
        return False
    

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
        if not commune:
            manual_bl = True
        else:
            manual_bl = False
    else:
        manual_bl = True
            
    if manual_bl:
        #print(f"Objet Géographique non trouvé: {the_id}")
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
