import type { Category, DealerPrice, Product } from './types';

type Row = [sku: string, name: string, cat: Category, rupees: number, stock: number, specs: string, compat?: string[]];

const PUR = ['CF-P-RO7', 'CF-P-RO8M', 'CF-P-RO10', 'CF-P-ALK'];
const rows: Row[] = [
  // Purifiers
  ['CF-P-RO7', 'AquaPure RO+UV 7 L', 'purifiers', 14999, 42, 'Technology:RO + UV + TDS Control;Storage:7 L Food-Grade Tank;Flow rate:15 L/h;Input TDS:Up to 2000 ppm'],
  ['CF-P-RO8M', 'AquaPure RO+UV Mineralizer 8 L', 'purifiers', 17999, 30, 'Technology:RO + UV + Active Mineralizer;Storage:8 L Stainless Tank;Flow rate:18 L/h;Input TDS:Up to 2000 ppm'],
  ['CF-P-RO10', 'AquaPure Pro RO 10 L', 'purifiers', 21999, 18, 'Technology:RO + UV + UF + Smart LED;Storage:10 L;Flow rate:20 L/h;Input TDS:Up to 2500 ppm'],
  ['CF-P-UV6', 'ClearFlow UV+UF 6 L', 'purifiers', 8999, 55, 'Technology:UV-C + Hollow-Fibre UF;Storage:6 L;Suitable TDS:Below 200 ppm;Power:24 W'],
  ['CF-P-UF5', 'ClearFlow UF 5 L', 'purifiers', 5499, 61, 'Technology:0.01 Micron UF Membrane;Storage:5 L;Suitable TDS:Below 150 ppm;Power:Non-Electric'],
  ['CF-P-GR20', 'PureGravity 20 L Storage', 'purifiers', 2999, 80, 'Technology:Gravity UF + Activated Carbon;Storage:20 L;Power:None Required'],
  ['CF-P-GR12', 'PureGravity Steel 12 L', 'purifiers', 2299, 74, 'Technology:Gravity UF;Storage:12 L;Body:SS 304 Stainless Steel'],
  ['CF-P-CT4', 'Countertop RO 4 L', 'purifiers', 11999, 22, 'Technology:RO + UV-C LED;Storage:4 L;Install:Compact Countertop'],
  ['CF-P-UC12', 'Under-Counter RO 12 L', 'purifiers', 24999, 12, 'Technology:RO + UV + Mineralizer;Storage:12 L Hydro-Pneumatic;Install:Under-Sink with Chrome Faucet'],
  ['CF-P-COM25', 'Commercial RO 25 LPH', 'purifiers', 38999, 8, 'Technology:Twin-Membrane Commercial RO;Capacity:25 L/h;Suitable TDS:Up to 2500 ppm;Frame:SS 304 Skid'],
  ['CF-P-COM50', 'Commercial RO 50 LPH', 'purifiers', 58999, 5, 'Technology:High-Recovery Commercial RO;Capacity:50 L/h;Suitable TDS:Up to 3000 ppm;Frame:SS 304 Skid'],
  ['CF-P-ALK', 'Alkaline RO 9 L', 'purifiers', 19999, 20, 'Technology:RO + UV + Alkaline pH Enhancer;Storage:9 L;Output pH:8.5 - 9.5;Carafe:Borosilicate Glass'],
  // Dispensers
  ['CF-D-HC', 'Hot & Cold Floor Dispenser', 'dispensers', 11499, 26, 'Cooling:High-Efficiency Compressor;Hot water:85-95 °C (5 L/h);Loading:Bottom Concealed'],
  ['CF-D-TT', 'Top-Loading Water Dispenser', 'dispensers', 6999, 33, 'Cooling:Ambient + Cold (10 °C);Loading:Top 20 L Jar;Child Lock:Included'],
  ['CF-D-CT', 'Countertop Hot & Cold Dispenser', 'dispensers', 7499, 28, 'Cooling:Thermoelectric;Hot water:85-95 °C;Install:Countertop'],
  ['CF-D-BL', 'Bottom-Loading Compressor Dispenser', 'dispensers', 14999, 14, 'Cooling:R134a Compressor;Loading:Bottom Easy-Slide;Cabinet:Brushed Steel + Navy'],
  ['CF-D-HOT', 'Hot Water Dispenser', 'dispensers', 3999, 40, 'Heating:1.5 kW Rapid Boil;Capacity:2.5 L;Safety:Dry-Boil Thermal Cut-Off'],
  ['CF-D-INS', 'Instant Hot Tap', 'dispensers', 5499, 19, 'Heating:Instant Inline;Install:Under-Counter Tank;Safety:Child Lock Lever'],
  // Pumps
  ['CF-PU-100', 'RO Booster Pump 100 GPD', 'pumps', 1599, 90, 'Voltage:24 V DC;Rating:100 GPD;Max pressure:100 psi;Ports:3/8 in Brass', PUR],
  ['CF-PU-75', 'RO Booster Pump 75 GPD', 'pumps', 1299, 95, 'Voltage:24 V DC;Rating:75 GPD;Max pressure:100 psi;Noise:< 52 dB', PUR],
  ['CF-PU-150', 'Diaphragm Pump 150 GPD', 'pumps', 1899, 64, 'Voltage:24 V DC;Rating:150 GPD;Max pressure:120 psi;Duty:Heavy Duty', ['CF-P-COM25']],
  ['CF-PU-BTL', 'Manual Bottle Dispenser Pump', 'pumps', 399, 220, 'Fits:Standard 20 L Jars;Material:Food-Grade BPA-Free PP;Type:Vacuum Hand Press'],
  ['CF-PU-SUB', 'Submersible Transfer Pump 0.5 HP', 'pumps', 3499, 24, 'Power:0.5 HP Copper Winding;Head:20 m;Use:Raw Water Feed'],
  ['CF-PU-DOS', 'Chemical Dosing Pump', 'pumps', 2799, 15, 'Flow:0 - 5 L/h Adjustable;Power:230 V AC;Use:Commercial Antiscalant Dosing'],
  // Filters
  ['CF-F-SED10', 'Sediment Filter 10 in', 'filters', 349, 300, 'Rating:5 Micron;Length:10 in;Material:Multi-Layer Spun Polypropylene'],
  ['CF-F-CB10', 'Carbon Block Filter 10 in', 'filters', 449, 260, 'Rating:5 Micron;Length:10 in;Removes:Free Chlorine, VOCs, Odor'],
  ['CF-F-HSG10', 'Pre-Filter Housing 10 in', 'filters', 899, 70, 'Port:1/4 in Brass Thread;Length:10 in;Max pressure:6 bar;Includes:Spanner & Bracket'],
  ['CF-F-INL', 'Inline Sediment Filter', 'filters', 249, 280, 'Connection:1/4 in Quick-Connect;Rating:5 Micron;Use:Sealed Inline Stage', PUR],
  ['CF-F-BB20', 'Big Blue Housing 20 in', 'filters', 1599, 36, 'Port:1 in NPT;Length:20 in;Use:Whole-House Pre-Filtration'],
  ['CF-F-UF', 'UF Membrane Cartridge', 'filters', 749, 120, 'Pore size:0.01 Micron;Type:Hollow Fibre;Use:Bacteria & Cyst Reduction', ['CF-P-UV6', 'CF-P-UF5', 'CF-P-RO10']],
  ['CF-F-PC', 'Post-Carbon Inline Filter', 'filters', 299, 210, 'Connection:1/4 in Quick-Connect;Media:Coconut Shell Carbon;Position:Post-RO Polisher', PUR],
  ['CF-F-FE10', 'Iron-Removal Filter 10 in', 'filters', 699, 85, 'Length:10 in;Removes:Dissolved Iron & Manganese;Max flow:3 L/min'],
  // Cartridges
  ['CF-C-M75', 'RO Membrane 75 GPD', 'cartridges', 1199, 140, 'Rating:75 GPD;Size:1812 Standard;Salt Rejection:96%;Max TDS:2000 ppm', PUR],
  ['CF-C-M100', 'RO Membrane 100 GPD', 'cartridges', 1399, 130, 'Rating:100 GPD;Size:1812 High-Flow;Salt Rejection:97%;Max TDS:2500 ppm', PUR],
  ['CF-C-UV6', 'UV Lamp 6 W', 'cartridges', 599, 160, 'Power:6 W Germicidal;Wavelength:254 nm;Rated Life:8,000 Hours', ['CF-P-RO7', 'CF-P-UV6']],
  ['CF-C-UV11', 'UV Lamp 11 W', 'cartridges', 799, 110, 'Power:11 W High-Output;Wavelength:254 nm;Rated Life:8,000 Hours', ['CF-P-RO10', 'CF-P-ALK']],
  ['CF-C-MIN', 'Mineral Cartridge', 'cartridges', 549, 150, 'Enrichment:Calcium & Magnesium;Connection:1/4 in Quick-Connect;Life:6,000 L', ['CF-P-RO8M', 'CF-P-UC12']],
  ['CF-C-ALK', 'Alkaline Cartridge', 'cartridges', 649, 100, 'Output pH:8.5 - 9.5;ORP Reduction:-150 mV;Connection:1/4 in', ['CF-P-ALK']],
  ['CF-C-SCL', 'Scale Inhibitor Cartridge', 'cartridges', 899, 90, 'Media:Food-Grade Polyphosphate;Protects:RO Membrane & Heating Elements;Connection:1/2 in'],
  ['CF-C-KIT7', 'Annual Service Kit for 7 L RO+UV', 'cartridges', 1899, 75, 'Contains:Pre-Sediment, Pre-Carbon, Post-Carbon, 75 GPD Membrane;Fits:CF-P-RO7', ['CF-P-RO7']],
  ['CF-C-3ST', '3-Stage Pre-Filter Replacement Set', 'cartridges', 1099, 95, 'Contains:Spun PP, GAC, Carbon Block;Size:10 in Universal;Interval:6 Months'],
  ['CF-C-CU', 'Active Copper Cartridge', 'cartridges', 749, 70, 'Infusion:Controlled Trace Copper;Connection:1/4 in Quick-Connect', PUR],
  // Spare parts
  ['CF-S-SOL', 'Solenoid Valve 24 V', 'spare-parts', 549, 130, 'Voltage:24 V DC;Port:1/4 in Quick-Connect;Type:Normally Closed Copper Coil', PUR],
  ['CF-S-SMPS', 'SMPS Adapter 24 V 1.5 A', 'spare-parts', 449, 150, 'Output:24 V DC / 1.5 A;Input:100-240 V AC;Protection:Surge & Short-Circuit', PUR],
  ['CF-S-MHSG', '1812 RO Membrane Housing', 'spare-parts', 599, 80, 'Fits:1812 / 2012 Membranes;Material:Virgin Food-Grade ABS;Double O-Ring:Yes'],
  ['CF-S-FLW', 'Flow Restrictor FR-450', 'spare-parts', 99, 400, 'Rating:450 ml/min;Connection:1/4 in Push-Fit;Use:Reject Line Backpressure'],
  ['CF-S-FLT', 'Tank Float Valve Assembly', 'spare-parts', 199, 190, 'Connection:1/4 in;Use:Auto Shut-Off Storage Tank;Material:Food-Grade Silicone & PP'],
  ['CF-S-TAP', 'Chrome Gooseneck Purifier Tap', 'spare-parts', 349, 175, 'Connection:1/4 in;Finish:Triple-Plated Chrome Brass;Spout:360° Swivel'],
  ['CF-S-PSW', 'High-Pressure Cut-Off Switch', 'spare-parts', 349, 120, 'Cut-Off:35 psi;Connection:1/4 in;Use:Auto Pump Shut-Off When Tank Full', PUR],
  ['CF-S-TUB', 'Food-Grade LLDPE Tubing 1/4 in (10 m)', 'spare-parts', 299, 240, 'Length:10 Meters;Outer Diameter:1/4 in;Pressure Rating:150 psi'],
  ['CF-S-QC', 'Quick-Connect Fitting Assortment (12 pcs)', 'spare-parts', 249, 260, 'Contents:4 Elbows, 4 Tees, 4 Straight Connectors;Size:1/4 in Push-Fit;Material:Acetal'],
  ['CF-S-TDS', 'Digital Inline TDS Adjuster Valve', 'spare-parts', 449, 105, 'Adjustment:Fine Needle Valve;Port:1/4 in;Use:Mineral & TDS Blending'],
];

const DESC: Record<Category, string> = {
  purifiers:
    'Multi-stage water purification system engineered for Indian municipal, borewell, and tanker water supplies. Delivers consistent TDS reduction, UV-C disinfection, and balanced mineral taste.',
  dispensers:
    'Commercial and residential temperature-controlled water dispenser featuring food-grade stainless steel reservoirs and energy-efficient cooling.',
  pumps:
    'Precision diaphragm booster and transfer pump engineered for stable RO membrane feed pressure and quiet continuous operation.',
  filters:
    'Genuine replacement filtration stage manufactured from food-grade media. Replace at recommended service intervals to maintain flow rate and water clarity.',
  cartridges:
    'Certified RO membrane, germicidal UV-C lamp, and mineral enrichment cartridge designed for Califnco purification systems.',
  'spare-parts':
    'OEM electrical, hydraulic, and plumbing component for water purifier installation, servicing, and pressure regulation.',
};

const DEFAULT_STAGES: Record<Category, string[]> = {
  purifiers: [
    'Stage 1: 5-Micron Spun Polypropylene Pre-Sediment Filter (removes sand, silt, and suspended particulates)',
    'Stage 2: Granular Activated Carbon Filter (adsorbs free chlorine, organic compounds, and odor)',
    'Stage 3: Sintered Carbon Block Filter (protects membrane and polishes fine sediment)',
    'Stage 4: High-Recovery Thin-Film Composite RO Membrane (reduces dissolved salts, heavy metals, and TDS up to 96%)',
    'Stage 5: 254 nm Quartz UV-C Disinfection Chamber (inactivates waterborne bacteria and viruses)',
    'Stage 6: Post-Carbon & Mineral Balancer (restores natural pH and crisp taste)',
  ],
  dispensers: [
    'Food-Grade SS 304 Hot & Cold Reservoirs with Child-Safety Hot Water Lock',
    'High-Efficiency Compressor Cooling (8–10 °C) & Rapid Heating (85–95 °C)',
  ],
  pumps: [
    'Self-Priming Diaphragm Chamber with Thermal Overload Protection',
    'Low-Vibration Rubber Mounting Feet (< 52 dB Operating Noise)',
  ],
  filters: [
    ' Depth-Graded Polypropylene / Coconut-Shell Activated Carbon Filtration Media',
  ],
  cartridges: [
    'High-Rejection Thin-Film Composite Membrane / Calibrated Mineral Media',
  ],
  'spare-parts': [
    'Factory-Tested Hydraulic & Electrical Tolerance Compliance',
  ],
};

const DEFAULT_WARRANTY: Record<Category, string> = {
  purifiers: '1 Year Comprehensive Onsite Warranty + 2 Scheduled Preventive Maintenance Visits',
  dispensers: '1 Year Comprehensive Warranty on Cooling Compressor & Heating Element',
  pumps: '1 Year Replacement Warranty against Manufacturing Defects',
  filters: 'Consumable Filtration Media — 6-Month / 3,000 L Service Life',
  cartridges: 'Consumable Cartridge — 12-Month / 6,000 L Rated Service Life',
  'spare-parts': '6-Month OEM Component Replacement Warranty',
};

const DEFAULT_DIMENSIONS: Record<Category, string> = {
  purifiers: '380 × 270 × 505 mm',
  dispensers: '310 × 340 × 1040 mm',
  pumps: '205 × 110 × 105 mm',
  filters: '254 × 64 × 64 mm (10 in Standard)',
  cartridges: '298 × 48 × 48 mm',
  'spare-parts': 'Standard 1/4 in Push-Fit Form Factor',
};

const FEATURED_SKUS = new Set(['CF-P-RO7', 'CF-P-RO8M', 'CF-P-ALK', 'CF-P-RO10', 'CF-D-BL', 'CF-C-KIT7']);

const SALE_PRICES_RUPEES: Record<string, number> = {
  'CF-P-RO7': 13499,
  'CF-P-RO8M': 16499,
  'CF-P-ALK': 18499,
  'CF-D-BL': 13999,
  'CF-C-KIT7': 1699,
};

export const SEED_PRODUCTS: Product[] = rows.map(([sku, name, category, rupees, stock, specs, compat]) => {
  const specObj = Object.fromEntries(
    specs.split(';').map((s) => {
      const [k, ...v] = s.split(':');
      return [k!.trim(), v.join(':').trim()];
    }),
  );
  const saleRupees = SALE_PRICES_RUPEES[sku];
  return {
    sku,
    name: `Califnco ${name}`,
    category,
    description: `${DESC[category]} Model ${sku} (${name}) is factory-tested for pressure integrity and drinking-water safety.`,
    pricePaise: rupees * 100,
    salePricePaise: saleRupees ? saleRupees * 100 : null,
    wholesalePricePaise: Math.round((rupees * 100 * (['purifiers', 'dispensers', 'pumps'].includes(category) ? 0.82 : 0.78)) / 100) * 100,
    stock,
    specs: specObj,
    compatibleWith: compat ?? [],
    image: `/img/${category}.svg`,
    imageAlt: `Califnco ${name} (${sku}) product photograph`,
    features: Object.entries(specObj).map(([k, v]) => `${k}: ${v}`),
    filtrationStages: DEFAULT_STAGES[category],
    dimensions: DEFAULT_DIMENSIONS[category],
    warranty: DEFAULT_WARRANTY[category],
    installationInfo:
      category === 'purifiers' || category === 'dispensers'
        ? 'Standard technician installation available within 24–48 hours of delivery. Book online from the Installation & Service page.'
        : 'Compatible with standard 1/4-inch push-fit connectors; technician visit optional.',
    active: true,
    status: 'published',
    featured: FEATURED_SKUS.has(sku),
    demo: true,
  };
});

/** Active admin-managed catalog records (demo: false) used when initializing a new catalog database. */
export const INITIAL_ACTIVE_CATALOG: Product[] = SEED_PRODUCTS.map((p) => ({
  ...p,
  demo: false,
  active: true,
  status: 'published',
}));

/** Dealer margin: 22% off retail for consumables/parts, 18% for appliances. */
export const SEED_DEALER_PRICES: DealerPrice[] = SEED_PRODUCTS.map((p) => ({
  sku: p.sku,
  pricePaise: Math.round((p.pricePaise * (['purifiers', 'dispensers', 'pumps'].includes(p.category) ? 0.82 : 0.78)) / 100) * 100,
}));
