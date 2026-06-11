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
  "dress-length": [
    { id: "mini", label: "Mini" },
    { id: "midi", label: "Midi" },
    { id: "maxi", label: "Maxi" },
    { id: "knee_length", label: "Knee length" },
    { id: "ankle_length", label: "Ankle length" }
  ],
  "dress-type": [
    { id: "a-line", label: "A-line" },
    { id: "babydoll", label: "Babydoll" },
    { id: "blazer", label: "Blazer" },
    { id: "bodycon", label: "Bodycon" },
    { id: "fishtail", label: "Fishtail" },
    { id: "pencil", label: "Pencil" },
    { id: "pleated", label: "Pleated" },
    { id: "shirt", label: "Shirt" },
    { id: "slip", label: "Slip" }
  ],
  "coat-type": [
    { id: "dufflecoat", label: "Duffle" },
    { id: "overcoat", label: "Overcoat" },
    { id: "parka", label: "Parka" },
    { id: "peacoat", label: "Peacoat" },
    { id: "puffer", label: "Puffer" },
    { id: "raincoat", label: "Raincoat" },
    { id: "teddy", label: "Sherpa" },
    { id: "trench", label: "Trench" }
  ],
  "jacket-type": [
    { id: "blazer", label: "Blazer" },
    { id: "bomber", label: "Bomber" },
    { id: "capes", label: "Cape" },
    { id: "duster", label: "Duster" },
    { id: "lightweight", label: "Lightweight" },
    { id: "ponchos", label: "Poncho" },
    { id: "puffer", label: "Puffer" },
    { id: "shacket", label: "Shacket" },
    { id: "varsity", label: "Varsity" },
    { id: "windbreaker", label: "Windbreaker" }
  ],
  "jumpssuit-type": [
    { id: "boilersuit", label: "Boilersuit" },
    { id: "unitard", label: "Unitard" },
    { id: "dungarees", label: "Dungarees" },
    { id: "romper", label: "Romper" }
  ],
  "dungarees-type": [
    { id: "denim", label: "Denim dungarees" },
    { id: "fabric", label: "Fabric dungarees" },
    { id: "short", label: "Short dungarees" }
  ],
  "heel-type": [
    { id: "stiletto", label: "Stiletto" },
    { id: "block", label: "Block heel" },
    { id: "platform", label: "Platform" },
    { id: "kitten", label: "Kitten heel" },
    { id: "wedge", label: "Wedge" },
    { id: "flat", label: "Flat" }
  ],
  "shoe-type": [
    { id: "trainers", label: "Trainers" },
    { id: "boots", label: "Boots" },
    { id: "sandals", label: "Sandals" },
    { id: "slides", label: "Slides" },
    { id: "heels", label: "Heels" },
    { id: "flats", label: "Flats" },
    { id: "loafers", label: "Loafers" }
  ],
  "boot-type": [
    { id: "ankle", label: "Ankle boots" },
    { id: "chelsea", label: "Chelsea boots" },
    { id: "combat", label: "Combat boots" },
    { id: "knee_high", label: "Knee high boots" },
    { id: "cowboy", label: "Cowboy boots" },
    { id: "platform", label: "Platform boots" }
  ],
  "bottom-fit": [
    { id: "acid-washed", label: "Acid-washed" },
    { id: "bleached", label: "Bleached" },
    { id: "capris", label: "Capri" },
    { id: "cargo", label: "Cargo" },
    { id: "chino", label: "Chino" },
    { id: "distressed", label: "Distressed" },
    { id: "embellished", label: "Embellished" },
    { id: "embroided", label: "Embroidered" },
    { id: "faded", label: "Faded" },
    { id: "painted", label: "Painted" },
    { id: "patched", label: "Patched" },
    { id: "printed", label: "Printed" },
    { id: "ripped", label: "Ripped" },
    { id: "stone-washed", label: "Stone-washed" }
  ],
  "hair-accesories-type": [
    { id: "hair-accessories", label: "Hair accessories" },
    { id: "hair-extensions-wigs", label: "Hair extensions and wigs" }
  ],
  "watches-type": [
    { id: "analogue", label: "Analogue" },
    { id: "digital", label: "Digital" }
  ],
  "gloves-and-mittens-type": [
    { id: "gloves", label: "Gloves" },
    { id: "mittens", label: "Mittens" }
  ],
  "hat-type": [
    { id: "beanie", label: "Beanies" },
    { id: "beret", label: "Berets" },
    { id: "bucket-hat", label: "Bucket hats" },
    { id: "caps-snapbacks", label: "Caps" },
    { id: "panamas-straw", label: "Straw hats" }
  ],
  "jewellery-type": [
    { id: "body-jewellery", label: "Body jewelry" },
    { id: "bracelet-anklets", label: "Bracelets and anklets" },
    { id: "brooches-pins", label: "Brooches and pins" },
    { id: "earrings-and-ear-cuffs", label: "Earrings and ear cuffs" },
    { id: "necklace", label: "Necklaces" },
    { id: "rings", label: "Rings" }
  ],
  "bag-type": [
    { id: "backpacks-rucksacks", label: "Backpacks" },
    { id: "beach-bag", label: "Beach bags" },
    { id: "clutch-bag", label: "Clutch bags" },
    { id: "crossbody-bag", label: "Crossbody bags" },
    { id: "diaper-bag", label: "Diaper bags" },
    { id: "bum-bag", label: "Fanny packs and belt bags" },
    { id: "luggage-travel", label: "Luggage and travel" },
    { id: "makeup-toiletry-bag", label: "Makeup and toiletry bags" },
    { id: "pencil-case", label: "Pencil cases" },
    { id: "satchel", label: "Satchels" },
    { id: "shoulder-bag", label: "Shoulder bags" },
    { id: "tote-bag", label: "Tote bags" }
  ],
  "bra-type": [
    { id: "balconette", label: "Balconette" },
    { id: "bralette", label: "Bralette" },
    { id: "padded", label: "Padded" },
    { id: "racerback", label: "Racerback" },
    { id: "sports", label: "Sports" },
    { id: "strapless", label: "Strapless" },
    { id: "t-shirt", label: "T-shirt" },
    { id: "wireless", label: "Wireless" }
  ],
  "panties-type": [
    { id: "bikini", label: "Bikini" },
    { id: "boyshorts", label: "Boyshort" },
    { id: "g-string", label: "G-string" },
    { id: "high-waisted", label: "High waisted" },
    { id: "hipster", label: "Hipster" },
    { id: "thong", label: "Thong" }
  ]
};
