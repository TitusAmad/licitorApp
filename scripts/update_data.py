# -*- coding: utf-8 -*-
"""
Created on Wed Oct  7 14:02:07 2026

@author: benja
"""

import sys
base_path = r"C:\Users\benja\Documents\licitor_app"
sys.path.insert(0, base_path)

from back.scrapper_licit.licitor_scrapper import scrapper_handler
from datetime import datetime, timedelta

#PARAMS

MAX_PAGES = 50
MAX_ANNOUNCES = None

MAX_PUB_DT = None
#MAX_PUB_DT = (datetime.now() - timedelta(days = 30)).date()

MAX_VIS_DT = (datetime.now() + timedelta(days = 15)).date()
#MAX_VIS_DT = None

#"annonces recentes", "visites a venir"
method_key = "visites a venir"

new_data = scrapper_handler(MAX_PAGES, MAX_ANNOUNCES,
                            MAX_PUB_DT, MAX_VIS_DT,
                            method_key)