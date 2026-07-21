export const DEPOP_CATEGORY_MAPPING = {
  // Tops
  "tshirts": ["occasion", "material", "body-fit", "size-fit"],
  "hoodies": ["occasion", "material", "body-fit", "size-fit"],
  "sweatshirts": ["occasion", "material", "body-fit", "size-fit"],
  "jumpers": ["occasion", "material", "body-fit", "size-fit"],
  "cardigans": ["occasion", "material", "body-fit", "size-fit"],
  "shirts": ["occasion", "material", "body-fit", "size-fit"],
  "polo-shirts": ["occasion", "material", "body-fit", "size-fit"],
  "blouses": ["occasion", "material", "body-fit", "size-fit"],
  "crop-top": ["body-fit", "material", "occasion", "size-fit"],
  "vests-tanks-camis": ["occasion", "material", "body-fit", "size-fit"],
  "corsets": ["occasion", "material", "body-fit"],
  "bodysuits": ["occasion", "material", "body-fit", "size-fit"],
  "other-tops": ["material", "body-fit", "occasion", "size-fit"],

  // Bottoms
  "jeans": ["bottom-fit", "bottom-style", "occasion", "material", "body-fit", "size-fit"],
  "joggers-tracksuits": ["bottom-fit", "bottom-style", "occasion", "material", "body-fit", "size-fit"],
  "trousers": ["bottom-fit", "bottom-style", "occasion", "material", "body-fit", "size-fit"],
  "shorts": ["occasion", "material", "body-fit", "size-fit"],
  "leggings": ["bottom-fit", "bottom-style", "occasion", "material", "body-fit", "size-fit"],
  "skirts": ["dress-length", "occasion", "material", "body-fit", "size-fit"],
  "other-bottoms": ["material", "body-fit", "bottom-fit", "occasion", "bottom-style", "size-fit"],

  // Dresses
  "casual-dresses": ["dress-length", "size-fit"],
  "formal-dresses": ["dress-length", "size-fit"],
  "going-out-dresses": ["dress-length", "size-fit"],
  "prom-dresses": ["dress-length", "size-fit"],
  "summer-dresses": ["dress-length", "size-fit"],
  "shift-dresses": ["dress-length", "size-fit"],
  "shirt-dresses": ["dress-length", "size-fit"],
  "wrap-dresses": ["dress-length", "size-fit"],
  "babydoll-dresses": ["dress-length", "size-fit"],
  "bodycon-dresses": ["dress-length", "size-fit"],
  "work-dresses": ["dress-length", "size-fit"],
  "wedding-dresses": ["dress-length", "size-fit"],
  "other-dresses": ["dress-length", "size-fit"],
  "dresses": ["dress-length", "dress-type", "occasion", "material", "body-fit", "size-fit"],

  // Coats and jackets
  "coats": ["coat-type", "occasion", "material", "body-fit", "size-fit"],
  "jackets": ["jacket-type", "occasion", "material", "body-fit", "size-fit"],
  "gilets": ["occasion", "material", "body-fit", "size-fit"],
  "other-coats-jackets": ["material", "body-fit", "occasion", "size-fit"],

  // Jumpsuits and rompers
  "jumpsuit": ["jumpssuit-type", "occasion", "material", "body-fit", "size-fit"],
  "playsuit-romper": ["occasion", "material", "body-fit", "size-fit"],
  "dungarees-overalls": ["dungarees-type", "occasion", "material", "body-fit", "size-fit"],
  "other-jumpsuit-and-playsuit": ["occasion", "material", "body-fit", "size-fit"],

  // Suits
  "suits": ["occasion", "material", "body-fit", "size-fit"],
  "tailored-jackets": ["occasion", "material", "body-fit", "size-fit"],
  "tailored-trousers": ["occasion", "material", "body-fit", "size-fit"],
  "waistcoats-vests": ["occasion", "material", "body-fit", "size-fit"],
  "tuxedos": ["occasion", "material", "body-fit", "size-fit"],
  "other-suits": ["material", "body-fit", "occasion", "size-fit"],

  // Footwear
  "trainers": ["trainers-type", "occasion", "material", "size-fit"],
  "slides": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "sandals": ["shoe-type", "occasion", "material", "size-fit"],
  "flipflops": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "slippers": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "brogues": ["shoe-type", "occasion", "material", "size-fit"],
  "oxfords": ["shoe-type", "occasion", "material", "size-fit"],
  "loafers": ["shoe-type", "occasion", "material", "size-fit"],
  "boots": ["boot-type", "occasion", "material", "size-fit"],
  "boat-shoes": ["shoe-type", "occasion", "material", "size-fit"],
  "espadrilles": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "ballet-shoes": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "clogs": ["heel-type", "shoe-type", "occasion", "material", "size-fit"],
  "courts": ["material", "heel-type", "shoe-type", "occasion", "size-fit"],
  "mules": ["shoe-type", "occasion", "material", "size-fit"],
  "first-shoes-baby-shoes": ["occasion", "material"],
  "other-footwear": ["occasion", "heel-type", "material", "size-fit"],
  
  // Underwear & Nightwear
  "pajamas": ["occasion", "material", "body-fit", "size-fit"],
  "robes": ["occasion", "material", "body-fit", "size-fit"],
  "other-nightwear": ["occasion", "material", "body-fit", "size-fit"],
  "bandeaus": ["occasion", "material", "body-fit", "size-fit"],
  "bras": ["occasion", "material", "body-fit", "size-fit"],
  "panties": ["occasion", "material", "body-fit", "size-fit"],
  "shapewear": ["occasion", "material", "body-fit", "size-fit"],
  "boxers-and-briefs": ["occasion", "material", "body-fit", "size-fit"],
  "vest-undershirts": ["occasion", "material", "body-fit", "size-fit"],
  "socks": ["occasion", "material", "body-fit", "size-fit"],
  "hosiery-tights": ["occasion", "material", "body-fit", "size-fit"],
  "other-underwear": ["occasion", "material", "body-fit", "size-fit"],

  // Swimwear
  "bikinis-and-tankini-sets": ["occasion", "material", "body-fit", "size-fit"],
  "bikini-and-tankini-tops": ["occasion", "material", "body-fit", "size-fit"],
  "bikini-and-tankini-bottoms": ["occasion", "material", "body-fit", "size-fit"],
  "swimsuit-one-piece": ["occasion", "material", "body-fit", "size-fit"],
  "swim-briefs-shorts": ["occasion", "material", "body-fit", "size-fit"],
  "cover-ups": ["occasion", "material", "body-fit", "size-fit"],
  "other-swim-beach-wear": ["occasion", "material", "body-fit", "size-fit"],

  // Beauty
  "bath-and-body": ["beauty-type"],
  "fragrance": ["beauty-type"],
  "hair-products": ["beauty-type"],
  "makeup": ["beauty-type"],
  "nails": ["beauty-type"],
  "grooming": ["beauty-type"],
  "skincare": ["beauty-type"],
  "tools-and-brushes": ["beauty-type"],

  // Accessories
  "bag": ["material"],
  "belt": ["material"],
  "hat": ["material", "size-fit"],
  "gloves": ["material", "size-fit"],
  "scarf-wraps": ["material"],
  "sunglasses": ["material"],
  "wallet-purses": ["material"],
  "jewellery": ["material"],
  "watch": ["material"],
  "hair-accessories": ["material"],
  "other-accessories": ["material"],

  // Everything Else
  "face-masks": ["material"],
  "dinnerware": ["material"],
  "furniture": ["material"],
  "decor-home-accesories": ["material"],
  "soft-furnishings-textiles": ["material"],
  "storage-and-organisation": ["material"],
  "laptop-cases-bag": ["material"],
  "phone-cases": ["material"],
  "cameras-and-accessories": ["material"],
  "collectibles": ["material"],
  "drawing-and-illustrations": ["material"],
  "mixed-media": ["material"],
  "paintings": ["material"],
  "photography": ["material"],
  "prints": ["material"],
  "sculptures": ["material"],
  "stickers": ["material"],
  "books": ["material"],
  "magazines": ["material"],
  "cds-and-vinyl": ["material"],
  "musical-instruments-and-dj": ["material"],
  "cake-decor": ["material"],
  "cards-invitations-gift-wrap": ["material"],
  "decorations": ["material"],
  "favours": ["material"],
  "party-hats": ["material"],
  "ball-sports": ["material"],
  "camping-hiking": ["material"],
  "cycling": ["material"],
  "fitness": ["material"],
  "golf": ["material"],
  "skates-skateboards-scooters": ["material"],
  "raquet-sports": ["material"],
  "water-sports": ["material"],
  "winter-sports": ["material"],
  "action-figures-playsets": ["material"],
  "building-sets-blocks": ["material"],
  "cars-vehicles": ["material"],
  "dolls-accessories": ["material"],
  "learning-toys": ["material"],
  "puzzles-games": ["material"],
  "stuffed-animals": ["material"],
  "trading-cards": ["material"],
  "umbrella": ["material"]
};

export const DEPOP_ATTRIBUTE_OPTIONS = {
  "bottom-fit": [
    {
      "id": "acid-washed",
      "label": "Acid-washed"
    },
    {
      "id": "bleached",
      "label": "Bleached"
    },
    {
      "id": "capris",
      "label": "Capri"
    },
    {
      "id": "cargo",
      "label": "Cargo"
    },
    {
      "id": "chino",
      "label": "Chino"
    },
    {
      "id": "distressed",
      "label": "Distressed"
    },
    {
      "id": "embellished",
      "label": "Embellished"
    },
    {
      "id": "embroided",
      "label": "Embroidered"
    },
    {
      "id": "faded",
      "label": "Faded"
    },
    {
      "id": "painted",
      "label": "Painted"
    },
    {
      "id": "patched",
      "label": "Patched"
    },
    {
      "id": "printed",
      "label": "Printed"
    },
    {
      "id": "ripped",
      "label": "Ripped"
    },
    {
      "id": "stone-washed",
      "label": "Stone-washed"
    }
  ],
  "hair-accesories-type": [
    {
      "id": "hair-accessories",
      "label": "Hair accessories"
    },
    {
      "id": "hair-extensions-wigs",
      "label": "Hair extensions and wigs"
    }
  ],
  "dress-type": [
    {
      "id": "a-line",
      "label": "A-line"
    },
    {
      "id": "babydoll",
      "label": "Babydoll"
    },
    {
      "id": "blazer",
      "label": "Blazer"
    },
    {
      "id": "bodycon",
      "label": "Bodycon"
    },
    {
      "id": "fishtail",
      "label": "Fishtail"
    },
    {
      "id": "pencil",
      "label": "Pencil"
    },
    {
      "id": "pleated",
      "label": "Pleated"
    },
    {
      "id": "shirt",
      "label": "Shirt"
    },
    {
      "id": "slip",
      "label": "Slip"
    }
  ],
  "watches-type": [
    {
      "id": "analogue",
      "label": "Analogue"
    },
    {
      "id": "digital",
      "label": "Digital"
    }
  ],
  "gloves-and-mittens-type": [
    {
      "id": "gloves",
      "label": "Gloves"
    },
    {
      "id": "mittens",
      "label": "Mittens"
    }
  ],
  "hat-type": [
    {
      "id": "beanie",
      "label": "Beanies"
    },
    {
      "id": "beret",
      "label": "Berets"
    },
    {
      "id": "bucket-hat",
      "label": "Bucket hats"
    },
    {
      "id": "caps-snapbacks",
      "label": "Caps"
    },
    {
      "id": "panamas-straw",
      "label": "Straw hats"
    }
  ],
  "jewellery-type": [
    {
      "id": "body-jewellery",
      "label": "Body jewelry"
    },
    {
      "id": "bracelet-anklets",
      "label": "Bracelets and anklets"
    },
    {
      "id": "brooches-pins",
      "label": "Brooches and pins"
    },
    {
      "id": "earrings-and-ear-cuffs",
      "label": "Earrings and ear cuffs"
    },
    {
      "id": "necklace",
      "label": "Necklaces"
    },
    {
      "id": "rings",
      "label": "Rings"
    }
  ],
  "bag-type": [
    {
      "id": "backpacks-rucksacks",
      "label": "Backpacks"
    },
    {
      "id": "beach-bag",
      "label": "Beach bags"
    },
    {
      "id": "clutch-bag",
      "label": "Clutch bags"
    },
    {
      "id": "crossbody-bag",
      "label": "Crossbody bags"
    },
    {
      "id": "diaper-bag",
      "label": "Diaper bags"
    },
    {
      "id": "bum-bag",
      "label": "Fanny packs and belt bags"
    },
    {
      "id": "luggage-travel",
      "label": "Luggage and travel"
    },
    {
      "id": "makeup-toiletry-bag",
      "label": "Makeup and toiletry bags"
    },
    {
      "id": "pencil-case",
      "label": "Pencil cases"
    },
    {
      "id": "satchel",
      "label": "Satchels"
    },
    {
      "id": "shoulder-bag",
      "label": "Shoulder bags"
    },
    {
      "id": "tote-bag",
      "label": "Tote bags"
    }
  ],
  "coat-type": [
    {
      "id": "dufflecoat",
      "label": "Duffle"
    },
    {
      "id": "overcoat",
      "label": "Overcoat"
    },
    {
      "id": "parka",
      "label": "Parka"
    },
    {
      "id": "peacoat",
      "label": "Peacoat"
    },
    {
      "id": "puffer",
      "label": "Puffer"
    },
    {
      "id": "raincoat",
      "label": "Raincoat"
    },
    {
      "id": "teddy",
      "label": "Sherpa"
    },
    {
      "id": "trench",
      "label": "Trench"
    }
  ],
  "jacket-type": [
    {
      "id": "blazer",
      "label": "Blazer"
    },
    {
      "id": "bomber",
      "label": "Bomber"
    },
    {
      "id": "capes",
      "label": "Cape"
    },
    {
      "id": "duster",
      "label": "Duster"
    },
    {
      "id": "lightweight",
      "label": "Lightweight"
    },
    {
      "id": "ponchos",
      "label": "Poncho"
    },
    {
      "id": "puffer",
      "label": "Puffer"
    },
    {
      "id": "shacket",
      "label": "Shacket"
    },
    {
      "id": "varsity",
      "label": "Varsity"
    },
    {
      "id": "windbreaker",
      "label": "Windbreaker"
    }
  ],
  "bra-type": [
    {
      "id": "balconette",
      "label": "Balconette"
    },
    {
      "id": "bralette",
      "label": "Bralette"
    },
    {
      "id": "padded",
      "label": "Padded"
    },
    {
      "id": "racerback",
      "label": "Racerback"
    },
    {
      "id": "sports",
      "label": "Sports"
    },
    {
      "id": "strapless",
      "label": "Strapless"
    },
    {
      "id": "t-shirt",
      "label": "T-shirt"
    },
    {
      "id": "wireless",
      "label": "Wireless"
    }
  ],
  "panties-type": [
    {
      "id": "bikini",
      "label": "Bikini"
    },
    {
      "id": "boyshorts",
      "label": "Boyshort"
    },
    {
      "id": "g-string",
      "label": "G-string"
    },
    {
      "id": "high-waisted",
      "label": "High waisted"
    },
    {
      "id": "hipster",
      "label": "Hipster"
    },
    {
      "id": "thong",
      "label": "Thong"
    }
  ],
  "shapewear-type": [
    {
      "id": "bodysuit",
      "label": "Bodysuits"
    },
    {
      "id": "shorts-briefs",
      "label": "Shorts and panties"
    },
    {
      "id": "slips",
      "label": "Slips"
    },
    {
      "id": "tank-top",
      "label": "Tops"
    }
  ],
  "boxers-type": [
    {
      "id": "boxers",
      "label": "Boxers"
    },
    {
      "id": "briefs",
      "label": "Briefs"
    },
    {
      "id": "thongs",
      "label": "Thongs"
    },
    {
      "id": "trunks",
      "label": "Trunks"
    }
  ],
  "vest-type": [
    {
      "id": "cami",
      "label": "Cami"
    },
    {
      "id": "cropped",
      "label": "Cropped"
    },
    {
      "id": "tank-top",
      "label": "Tank top"
    }
  ],
  "pajamas-type": [
    {
      "id": "2-piece",
      "label": "2 piece"
    },
    {
      "id": "pants",
      "label": "Bottoms"
    },
    {
      "id": "button-up",
      "label": "Button up"
    },
    {
      "id": "cami",
      "label": "Camis"
    },
    {
      "id": "chemises-slips",
      "label": "Chemises and slips"
    },
    {
      "id": "shorts",
      "label": "Shorts"
    }
  ],
  "sleepsuit-type": [
    {
      "id": "bodysuit",
      "label": "Onesies"
    },
    {
      "id": "sleepsuit",
      "label": "Sleepers"
    }
  ],
  "jumpssuit-type": [
    {
      "id": "palazzo",
      "label": "Palazzo"
    },
    {
      "id": "skinny",
      "label": "Skinny"
    },
    {
      "id": "straight",
      "label": "Straight leg"
    }
  ],
  "dungarees-type": [
    {
      "id": "trouser",
      "label": "Pants"
    },
    {
      "id": "shorts",
      "label": "Shorts"
    },
    {
      "id": "skirt",
      "label": "Skirt"
    }
  ],
  "fancy-dress-type": [
    {
      "id": "1960s",
      "label": "1960s"
    },
    {
      "id": "1970s",
      "label": "1970s"
    },
    {
      "id": "2-piece",
      "label": "2 piece"
    },
    {
      "id": "animals-and-nature",
      "label": "Animals and nature"
    },
    {
      "id": "christmas",
      "label": "Christmas"
    },
    {
      "id": "halloween",
      "label": "Halloween"
    },
    {
      "id": "superhero",
      "label": "Superhero"
    },
    {
      "id": "tv-book-and-film",
      "label": "TV, books and film"
    }
  ],
  "luggage-type": [
    {
      "id": "carry-on",
      "label": "Carry On"
    },
    {
      "id": "passport-holder",
      "label": "Passport Holder"
    },
    {
      "id": "suitcase",
      "label": "Suitcase"
    }
  ],
  "sunglasses-type": [
    {
      "id": "aviator",
      "label": "Aviator"
    },
    {
      "id": "cat-eye",
      "label": "Cat eye"
    },
    {
      "id": "oversized",
      "label": "Oversized"
    },
    {
      "id": "round",
      "label": "Round"
    },
    {
      "id": "square",
      "label": "Square"
    },
    {
      "id": "wayfarer",
      "label": "Wayfarer"
    }
  ],
  "wallet-type": [
    {
      "id": "cardholder",
      "label": "Cardholders"
    },
    {
      "id": "purse",
      "label": "Coin purses and pouches"
    },
    {
      "id": "moneyclip",
      "label": "Money clips"
    },
    {
      "id": "wallet",
      "label": "Wallets"
    }
  ],
  "boot-type": [
    {
      "id": "ankle",
      "label": "Ankle"
    },
    {
      "id": "biker-military",
      "label": "Biker"
    },
    {
      "id": "chelsea",
      "label": "Chelsea"
    },
    {
      "id": "combat",
      "label": "Combat"
    },
    {
      "id": "knee-high",
      "label": "Knee high"
    },
    {
      "id": "lace-up",
      "label": "Lace up"
    },
    {
      "id": "mid-calf",
      "label": "Mid calf"
    },
    {
      "id": "over-the-knee",
      "label": "Over the knee"
    },
    {
      "id": "platform",
      "label": "Platform"
    },
    {
      "id": "sock",
      "label": "Sock"
    }
  ],
  "shoe-type": [
    {
      "id": "buckle",
      "label": "Buckle"
    },
    {
      "id": "chunky",
      "label": "Chunky"
    },
    {
      "id": "embellished",
      "label": "Embellished"
    },
    {
      "id": "embossed",
      "label": "Embossed"
    },
    {
      "id": "lace-up",
      "label": "Lace up"
    },
    {
      "id": "open-toe-peep-toe",
      "label": "Open and peep toe"
    },
    {
      "id": "plain",
      "label": "Plain"
    },
    {
      "id": "platform",
      "label": "Platform"
    }
  ],
  "trainers-type": [
    {
      "id": "basketball",
      "label": "Basketball"
    },
    {
      "id": "embellished",
      "label": "Embellished"
    },
    {
      "id": "athletics",
      "label": "Gym"
    },
    {
      "id": "lifestyle",
      "label": "Lifestyle"
    },
    {
      "id": "running",
      "label": "Running"
    },
    {
      "id": "skateboard",
      "label": "Skateboarding"
    },
    {
      "id": "football",
      "label": "Soccer"
    },
    {
      "id": "tennis",
      "label": "Tennis"
    }
  ],
  "home": [
    {
      "id": "bathroom",
      "label": "Bathroom"
    },
    {
      "id": "bedroom",
      "label": "Bedroom"
    },
    {
      "id": "dining",
      "label": "Dining"
    },
    {
      "id": "garden",
      "label": "Garden"
    },
    {
      "id": "kitchen",
      "label": "Kitchen"
    },
    {
      "id": "office",
      "label": "Office"
    }
  ],
  "bath-body-type": [
    {
      "id": "bath-soak-bubbles",
      "label": "Bath salts and bubbles"
    },
    {
      "id": "body-wash",
      "label": "Body wash"
    },
    {
      "id": "exfoliant-scrub",
      "label": "Exfoliants and scrubs"
    },
    {
      "id": "hand-foot-care",
      "label": "Hand and footcare"
    },
    {
      "id": "hand-soap",
      "label": "Hand soap"
    },
    {
      "id": "moisturizer-body-oil",
      "label": "Moisturizers and body oils"
    },
    {
      "id": "suncare-tanning",
      "label": "Suncare and tanning"
    }
  ],
  "fragrance-type": [
    {
      "id": "body-spray",
      "label": "Body spray"
    },
    {
      "id": "deodrant",
      "label": "Deodorant"
    },
    {
      "id": "perfume",
      "label": "Perfume and cologne"
    }
  ],
  "hair-product-type": [
    {
      "id": "color",
      "label": "Color"
    },
    {
      "id": "conditioner",
      "label": "Conditioner"
    },
    {
      "id": "hairspray",
      "label": "Hairspray"
    },
    {
      "id": "heat-protectant",
      "label": "Heat protection"
    },
    {
      "id": "shampoo",
      "label": "Shampoo"
    },
    {
      "id": "styling",
      "label": "Styling"
    },
    {
      "id": "treatment-mask",
      "label": "Treatments and masks"
    }
  ],
  "makeup-type": [
    {
      "id": "blush",
      "label": "Blush"
    },
    {
      "id": "bronzer-contour",
      "label": "Bronzer and contour"
    },
    {
      "id": "brushes-tools",
      "label": "Brushes and tools"
    },
    {
      "id": "concealer",
      "label": "Concealer"
    },
    {
      "id": "eye-primer",
      "label": "Eye primer"
    },
    {
      "id": "brows",
      "label": "Eyebrows"
    },
    {
      "id": "eyeliner",
      "label": "Eyeliner"
    },
    {
      "id": "eyeshadow",
      "label": "Eyeshadow"
    },
    {
      "id": "foundation",
      "label": "Foundation"
    },
    {
      "id": "lipstick",
      "label": "Lipstick"
    },
    {
      "id": "mascara",
      "label": "Mascara"
    },
    {
      "id": "primer",
      "label": "Primer"
    }
  ],
  "skincare-type": [
    {
      "id": "acne-blemish",
      "label": "Acne and blemish"
    },
    {
      "id": "cleanser-exfoliant",
      "label": "Cleanser and exfoliant"
    },
    {
      "id": "eye-cream",
      "label": "Eye cream"
    },
    {
      "id": "makeup-remover",
      "label": "Makeup remover"
    },
    {
      "id": "mask",
      "label": "Masks"
    },
    {
      "id": "moisturizer",
      "label": "Moisturizers"
    },
    {
      "id": "peel",
      "label": "Peels"
    }
  ],
  "tools-type": [
    {
      "id": "appliances",
      "label": "Appliances"
    },
    {
      "id": "brushes",
      "label": "Brushes"
    },
    {
      "id": "tools",
      "label": "Tools"
    }
  ],
  "grooming-type": [
    {
      "id": "grooming-products",
      "label": "Grooming products"
    },
    {
      "id": "grooming-tools",
      "label": "Grooming tools"
    },
    {
      "id": "hair-removal",
      "label": "Hair removal"
    }
  ],
  "nails-type": [
    {
      "id": "false-nails",
      "label": "False nails"
    },
    {
      "id": "nail-art",
      "label": "Nail art"
    },
    {
      "id": "nail-brushes",
      "label": "Nail brushes"
    },
    {
      "id": "nail-clippers",
      "label": "Nail clippers"
    },
    {
      "id": "nail-files",
      "label": "Nail files"
    },
    {
      "id": "nail-polishes",
      "label": "Nail polish"
    },
    {
      "id": "nail-treatments",
      "label": "Nail treatments"
    }
  ],
  "skates-skateboards-scooters-type": [
    {
      "id": "inline-roller-skating-and-equipment",
      "label": "Inline and roller skating"
    },
    {
      "id": "protective-gear",
      "label": "Protective gear"
    },
    {
      "id": "scooters-equipment",
      "label": "Scooters"
    },
    {
      "id": "skateboarding-and-equipment",
      "label": "Skateboarding"
    }
  ],
  "fitness-type": [
    {
      "id": "balance-training-equipment",
      "label": "Balance training"
    },
    {
      "id": "pilates",
      "label": "Pilates"
    },
    {
      "id": "strength-training-equipment",
      "label": "Strength training"
    },
    {
      "id": "trampolines-accessories",
      "label": "Trampolines and accessories"
    }
  ],
  "cycling-type": [
    {
      "id": "bike-tools-equipment",
      "label": "Bike tools and equipment"
    },
    {
      "id": "bikes",
      "label": "Bikes"
    },
    {
      "id": "components-parts",
      "label": "Components and parts"
    },
    {
      "id": "helmets-accessories",
      "label": "Helmets and accessories"
    },
    {
      "id": "kids-bikes-accessories",
      "label": "Kids' bikes and accessories"
    },
    {
      "id": "protective-gear",
      "label": "Protective gear"
    },
    {
      "id": "lights-reflectors",
      "label": "Reflectors"
    }
  ],
  "camping-hiking-type": [
    {
      "id": "bags-packs",
      "label": "Bags and packs"
    },
    {
      "id": "camping-furniture",
      "label": "Camping furniture"
    },
    {
      "id": "camp-kitchen",
      "label": "Camping kitchens"
    },
    {
      "id": "camping-shelters",
      "label": "Camping shelters"
    },
    {
      "id": "child-carriers",
      "label": "Child carriers"
    },
    {
      "id": "hand-foot-warmers",
      "label": "Hand and foot warmers"
    },
    {
      "id": "gps-navigation",
      "label": "Navigation"
    },
    {
      "id": "bivy-bags",
      "label": "Sleeping bags"
    }
  ],
  "golf-type": [
    {
      "id": "golf-balls",
      "label": "Golf balls"
    },
    {
      "id": "golf-cart-accessories",
      "label": "Golf cart accessories"
    },
    {
      "id": "golf-carts",
      "label": "Golf carts"
    },
    {
      "id": "golf-club-bag-accessories",
      "label": "Golf club bag accessories"
    },
    {
      "id": "golf-club-bags",
      "label": "Golf club bags"
    },
    {
      "id": "golf-club-organisers",
      "label": "Golf club organizers"
    },
    {
      "id": "golf-club-parts",
      "label": "Golf club parts"
    },
    {
      "id": "golf-clubs",
      "label": "Golf clubs"
    }
  ],
  "winter-sports-type": [
    {
      "id": "curling",
      "label": "Curling"
    },
    {
      "id": "ice-hockey",
      "label": "Ice hockey"
    },
    {
      "id": "ice-skating",
      "label": "Ice skating"
    },
    {
      "id": "skiing",
      "label": "Skiing"
    },
    {
      "id": "sledding",
      "label": "Sledding"
    },
    {
      "id": "snowboarding",
      "label": "Snowboarding"
    },
    {
      "id": "snowshoeing",
      "label": "Snowshoeing"
    }
  ],
  "water-sports-type": [
    {
      "id": "boating",
      "label": "Boating"
    },
    {
      "id": "canoeing",
      "label": "Canoeing"
    },
    {
      "id": "diving-snorkelling",
      "label": "Diving and snorkelling"
    },
    {
      "id": "kayaking",
      "label": "Kayaking"
    },
    {
      "id": "kitesurfing",
      "label": "Kitesurfing"
    },
    {
      "id": "rowing-crew",
      "label": "Rowing"
    },
    {
      "id": "sailing",
      "label": "Sailing"
    }
  ],
  "cameras-and-accessories-type": [
    {
      "id": "accessories",
      "label": "Accessories"
    },
    {
      "id": "action-cameras-accessories",
      "label": "Action cameras"
    },
    {
      "id": "binoculars",
      "label": "Binoculars"
    },
    {
      "id": "camcorders",
      "label": "Camcorders"
    },
    {
      "id": "dvd",
      "label": "DVD"
    },
    {
      "id": "digital-cameras",
      "label": "Digital cameras"
    },
    {
      "id": "dummy-cameras",
      "label": "Dummy cameras"
    },
    {
      "id": "film-cameras",
      "label": "Film cameras"
    },
    {
      "id": "instant-cameras",
      "label": "Instant cameras"
    },
    {
      "id": "telescopes-optics",
      "label": "Telescopes and optics"
    },
    {
      "id": "vhs",
      "label": "VHS"
    }
  ],
  "cds-and-vinyl-type": [
    {
      "id": "blues",
      "label": "Blues"
    },
    {
      "id": "children-s-music",
      "label": "Children's music"
    },
    {
      "id": "classical",
      "label": "Classical"
    },
    {
      "id": "country",
      "label": "Country"
    },
    {
      "id": "dance-electronic",
      "label": "Dance and electronic"
    },
    {
      "id": "easy-listening",
      "label": "Easy listening"
    },
    {
      "id": "folk",
      "label": "Folk"
    },
    {
      "id": "plays-stories",
      "label": "Plays and stories"
    }
  ],
  "musical-instruments-and-dj-type": [
    {
      "id": "bass-guitars-gear",
      "label": "Bass guitars and accessories"
    },
    {
      "id": "drums-percussion",
      "label": "Drums and percussion"
    },
    {
      "id": "guitars-gear",
      "label": "Guitars and accessories"
    }
  ],
  "heel-type": [
    {
      "id": "block-heel",
      "label": "Block"
    },
    {
      "id": "flat",
      "label": "Flat"
    },
    {
      "id": "high-heel",
      "label": "High"
    },
    {
      "id": "kitten-heel",
      "label": "Kitten"
    },
    {
      "id": "mid-heel",
      "label": "Mid"
    }
  ],
  "bottom-style": [
    {
      "id": "bootcut",
      "label": "Bootcut"
    },
    {
      "id": "flare",
      "label": "Flare"
    },
    {
      "id": "high-waisted",
      "label": "High waisted"
    },
    {
      "id": "low-rise",
      "label": "Low rise"
    },
    {
      "id": "skinny",
      "label": "Skinny"
    },
    {
      "id": "slim",
      "label": "Slim"
    },
    {
      "id": "straight-leg",
      "label": "Straight leg"
    },
    {
      "id": "tailored",
      "label": "Tailored"
    },
    {
      "id": "wide-leg",
      "label": "Wide leg"
    },
    {
      "id": "tapered",
      "label": "tapered"
    },
    {
      "id": "relaxed",
      "label": "relaxed"
    }
  ],
  "item-length": [
    {
      "id": "long",
      "label": "Long"
    },
    {
      "id": "regular",
      "label": "Regular"
    },
    {
      "id": "short",
      "label": "Short "
    }
  ],
  "shoe-width": [
    {
      "id": "narrow",
      "label": "Narrow"
    },
    {
      "id": "regular",
      "label": "Regular"
    },
    {
      "id": "wide",
      "label": "Wide"
    }
  ],
  "dress-length": [
    {
      "id": "maxi",
      "label": "Maxi"
    },
    {
      "id": "midi",
      "label": "Midi"
    },
    {
      "id": "mini",
      "label": "Mini"
    }
  ],
  "neckline": [
    {
      "id": "cowl",
      "label": "Cowl"
    },
    {
      "id": "halter",
      "label": "Halter"
    },
    {
      "id": "henley",
      "label": "Henley"
    },
    {
      "id": "round",
      "label": "Round"
    },
    {
      "id": "scoop",
      "label": "Scoop"
    },
    {
      "id": "square",
      "label": "Square"
    },
    {
      "id": "sweetheart",
      "label": "Sweetheart"
    },
    {
      "id": "roll-neck",
      "label": "Turtleneck"
    },
    {
      "id": "v",
      "label": "V neck"
    }
  ],
  "sleeve-length": [
    {
      "id": "3-4-sleeve",
      "label": "3/4 sleeve"
    },
    {
      "id": "long",
      "label": "Long"
    },
    {
      "id": "short",
      "label": "Short"
    },
    {
      "id": "sleeveless",
      "label": "Sleeveless"
    }
  ],
  "tops-fit": [
    {
      "id": "cropped",
      "label": "Cropped"
    },
    {
      "id": "long",
      "label": "Long"
    },
    {
      "id": "oversized",
      "label": "Oversized"
    }
  ],
  "material": [
    {
      "id": "acrylic",
      "label": "Acrylic"
    },
    {
      "id": "canvas",
      "label": "Canvas"
    },
    {
      "id": "cashmere",
      "label": "Cashmere"
    },
    {
      "id": "corduroy",
      "label": "Corduroy"
    },
    {
      "id": "cotton",
      "label": "Cotton"
    },
    {
      "id": "cotton-organic",
      "label": "Cotton - Organic"
    },
    {
      "id": "cotton-recycled",
      "label": "Cotton - Recycled"
    },
    {
      "id": "crochet",
      "label": "Crochet"
    },
    {
      "id": "denim",
      "label": "Denim"
    },
    {
      "id": "elastane-lycra-spandex",
      "label": "Elastane / Lycra / Spandex"
    },
    {
      "id": "sequins-gems",
      "label": "Embellished"
    },
    {
      "id": "faux-fur",
      "label": "Faux fur"
    },
    {
      "id": "faux-leather",
      "label": "Faux leather"
    },
    {
      "id": "fleece",
      "label": "Fleece"
    },
    {
      "id": "hemp",
      "label": "Hemp"
    },
    {
      "id": "jersey",
      "label": "Jersey"
    },
    {
      "id": "knitted",
      "label": "Knitted"
    },
    {
      "id": "lace",
      "label": "Lace"
    },
    {
      "id": "leather",
      "label": "Leather"
    },
    {
      "id": "linen",
      "label": "Linen"
    },
    {
      "id": "lyocell",
      "label": "Lyocell"
    },
    {
      "id": "modal",
      "label": "Modal"
    },
    {
      "id": "nylon",
      "label": "Nylon"
    },
    {
      "id": "polyester",
      "label": "Polyester"
    },
    {
      "id": "polyester-recycled",
      "label": "Polyester - Recycled"
    },
    {
      "id": "rayon",
      "label": "Rayon"
    },
    {
      "id": "rubber",
      "label": "Rubber"
    },
    {
      "id": "silk",
      "label": "Silk"
    },
    {
      "id": "suede",
      "label": "Suede"
    },
    {
      "id": "tweed",
      "label": "Tweed"
    },
    {
      "id": "velvet",
      "label": "Velvet"
    },
    {
      "id": "viscose",
      "label": "Viscose "
    },
    {
      "id": "wool",
      "label": "Wool"
    }
  ],
  "occasion": [
    {
      "id": "daytime",
      "label": "Casual"
    },
    {
      "id": "festival",
      "label": "Festival"
    },
    {
      "id": "gifting",
      "label": "Gifting"
    },
    {
      "id": "going-out-evening",
      "label": "Going out"
    },
    {
      "id": "outdoors",
      "label": "Outdoors"
    },
    {
      "id": "celebration",
      "label": "Party"
    },
    {
      "id": "relaxation",
      "label": "Relaxation"
    },
    {
      "id": "school",
      "label": "School"
    },
    {
      "id": "ski",
      "label": "Ski"
    },
    {
      "id": "special-occasion",
      "label": "Special Occasion"
    },
    {
      "id": "summertime",
      "label": "Summer"
    },
    {
      "id": "holiday",
      "label": "Vacation"
    },
    {
      "id": "winter",
      "label": "Winter"
    },
    {
      "id": "work",
      "label": "Work"
    },
    {
      "id": "sport-workout",
      "label": "Workout"
    }
  ],
  "body-fit": [
    {
      "id": "maternity",
      "label": "Maternity"
    },
    {
      "id": "petite",
      "label": "Petite"
    },
    {
      "id": "plus-size",
      "label": "Plus size"
    },
    {
      "id": "tall",
      "label": "Tall"
    }
  ]
};
