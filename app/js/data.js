/* ── CONSTANTS ── */
const SC   = {go:'#2a9d5c', maybe:'#c97d0a', nogo:'#c0392b'};
const SBG  = {go:'rgba(42,157,92,.12)', maybe:'rgba(201,125,10,.1)', nogo:'rgba(192,57,43,.1)'};
const STXT = {go:'#1a7a44', maybe:'#7a4a00', nogo:'#8b1a1a'};
const MAXKN = 45, B1 = 12/45*100, B2 = 19/45*100, B3 = 29/45*100;

const API_BASE = 'https://wk1.duckdns.org/api';

/* ── STATIC SPOT CONFIG (non-weather fields) ── */
/* depth_m = static fallback (MLLW datum); updated at runtime from API/GEBCO */
const SPOTS_CONFIG = [
  // North Carolina — Hatteras / OBX (Pamlico Sound — notoriously shallow)
  {id:0,  name:'Salvo — Sound',              short:'Salvo',         slug:'salvo',            region:'Hatteras, NC',       state:'nc', fav:true,  lat:35.5539, lon:-75.4682, cam:true,  camLive:true,  depth_m:1.2,
   desc:'Pamlico Sound flat-water spot with consistent SW thermal winds. Shallow sandy bottom ideal for all levels; excellent freestyle terrain.'},
  {id:1,  name:'Canadian Hole',              short:'Can.Hole',      slug:'canadian',         region:'Hatteras, NC',       state:'nc', fav:true,  lat:35.5306, lon:-75.4686, cam:true,  camLive:true,  depth_m:1.0,
   desc:'World-renowned Pamlico Sound kite mecca near Avon. Ultra-flat knee-deep water and strong NE thermals have made it a global kite destination since the 1990s.'},
  {id:2,  name:'Buxton Kite Pt.',            short:'Buxton',        slug:'buxton',           region:'Hatteras, NC',       state:'nc', fav:false, lat:35.2697, lon:-75.5175, cam:true,  camLive:false, depth_m:1.5,
   desc:'Sheltered sound-side cove near Cape Hatteras point. SE/SW thermals push across the sound; flat water and sandy launch make it suitable for progression riders.'},
  {id:3,  name:'Waves Soundside',            short:'Waves',         slug:'waves-soundside',  region:'Waves, NC',          state:'nc', fav:false, lat:35.5750, lon:-75.4780, cam:true,  camLive:true,  depth_m:1.2,
   desc:'Home of Wind Over Waves kite school on Pamlico Sound. Strong NE/SW corridor winds with grassy shallows giving way to glassy flat water.'},
  {id:4,  name:'Kite Point (The Cove)',      short:'Kite Point',    slug:'kite-point',       region:'Avon, NC',           state:'nc', fav:false, lat:35.3540, lon:-75.5080, cam:false, camLive:false, depth_m:1.5,
   desc:'Protected sound pocket between Avon and Buxton, locally called "The Cove". Light chop and 1.5m depth; popular with intermediate and advancing riders.'},
  // North Carolina — other
  {id:5,  name:"Jockey's Ridge Soundside",  short:"Jockey's Ridge",slug:'jockeys-ridge',    region:'Nags Head, NC',      state:'nc', fav:false, lat:35.9638, lon:-75.6582, cam:false, camLive:false, depth_m:2.0,
   desc:'Roanoke Sound launch below the tallest natural sand dune on the US East Coast. Steady NE winds funnel across the narrow sound; great for beginners and freestylers.'},
  {id:6,  name:'Wrightsville Beach',         short:'Wrightsville',  slug:'wrightsville',     region:'Wilmington, NC',     state:'nc', fav:false, lat:34.2104, lon:-77.7966, cam:false, camLive:false, depth_m:1.8,
   desc:'Atlantic Ocean beach near Wilmington with reliable afternoon sea-breeze thermals. Mild surf, clear water and easy boardwalk access; more exposed than OBX sound spots.'},
  // South Carolina
  {id:7,  name:"Sullivan's Island Stn 28.5",short:"Sullivan's Is.", slug:'sullivans-island', region:"Sullivan's Is., SC",  state:'sc', fav:false, lat:32.7651, lon:-79.8451, cam:false, camLive:false, depth_m:2.5,
   desc:"Designated kite zone at Station 28.5 on Sullivan's Island near Charleston. Strong SW afternoon sea breeze, sandy beach launch, and light Atlantic surf."},
  {id:8,  name:'Isle of Palms 3rd Ave',      short:'Isle of Palms', slug:'isle-of-palms',    region:'Isle of Palms, SC',  state:'sc', fav:false, lat:32.7868, lon:-79.7948, cam:false, camLive:false, depth_m:2.5,
   desc:'Quiet Atlantic beach north of Charleston at 3rd Ave access. E/SE sea breeze, gentle sandbars and typically uncrowded conditions mid-week.'},
  {id:9,  name:'Folly Beach County Park',    short:'Folly Beach',   slug:'folly-beach',      region:'Folly Beach, SC',    state:'sc', fav:false, lat:32.6470, lon:-79.9600, cam:false, camLive:false, depth_m:2.0,
   desc:'SW tip of Folly Island near the tidal inlet. Wide sandy beach with variable tidal currents; best sessions on SW sea breeze with incoming tide.'},
  {id:10, name:'Hilton Head North Beach',    short:'Hilton Head',   slug:'hilton-head',      region:'Hilton Head, SC',    state:'sc', fav:false, lat:32.1436, lon:-80.7453, cam:false, camLive:false, depth_m:3.0,
   desc:'Open Atlantic strand on Hilton Head Island. Steady afternoon SE sea breeze, gentle longshore drift and firm sand launch in the designated beach zone.'},
  // Florida
  {id:11, name:'Miami Beach St. 25',         short:'Miami 25th',    slug:'miami25',          region:'Miami, FL',          state:'fl', fav:false, lat:25.7797, lon:-80.1300, cam:true,  camLive:false, depth_m:3.5,
   desc:'Classic Miami kite spot at 25th St Beach Access on the Atlantic. NE trade winds 15–25 kn on most winter afternoons; turquoise water and iconic skyline backdrop.'},
  {id:12, name:'Crandon Park Kite Beach',    short:'Crandon Park',  slug:'crandon-park',     region:'Key Biscayne, FL',   state:'fl', fav:false, lat:25.7095, lon:-80.1547, cam:false, camLive:false, depth_m:2.0,
   desc:"Dedicated kite beach on Key Biscayne's south shore. Protected by barrier reef with flat Biscayne Bay water; strong SE trades in winter, sea breeze in summer."},
  {id:13, name:'Carlin Park',                short:'Carlin Park',   slug:'carlin-park',      region:'Jupiter, FL',        state:'fl', fav:false, lat:26.9292, lon:-80.0728, cam:false, camLive:false, depth_m:3.0,
   desc:'Jupiter Inlet beach park on the Atlantic. Consistent E/SE sea breeze 15–22 kn most afternoons, sandy bottom and good access make it a popular Palm Beach County spot.'},
  {id:14, name:'The 520 Slick',              short:'520 Slick',     slug:'slick-520',        region:'Cocoa Beach, FL',    state:'fl', fav:false, lat:28.3600, lon:-80.6750, cam:false, camLive:false, depth_m:1.5,
   desc:'Flat, sheltered Banana River Lagoon at the SR-520 causeway. E winds off the Atlantic create ideal bump-and-jump conditions; Space Coast landmark with frequent launches.'},
  {id:15, name:'Skyway Beach East',          short:'Skyway Beach',  slug:'skyway-beach',     region:'St. Petersburg, FL', state:'fl', fav:false, lat:27.6195, lon:-82.5783, cam:false, camLive:false, depth_m:3.5,
   desc:'Tampa Bay north shore at the Sunshine Skyway Bridge. Bay thermal winds typically 12–20 kn in the afternoon; flat water with the iconic bridge as a backdrop.'},
  // Rio de Janeiro, Brazil
  {id:16, name:'Jardim de Alá',              short:'Jd. de Alá',    slug:'jardim-de-ala',    region:'Leblon, Rio de Janeiro', state:'rj', fav:false, lat:-22.9833, lon:-43.2219, cam:false, camLive:false, depth_m:1.0,
   desc:'Canal entre Ipanema e Leblon conectando a Lagoa Rodrigo de Freitas ao Atlântico. Água rasa e protegida, ideal para iniciantes e freestyle com ventos de leste.'},
  {id:17, name:'Praia do Pepê',              short:'Pepê',          slug:'praia-do-pepe',    region:'Barra da Tijuca, RJ',    state:'rj', fav:true,  lat:-23.0060, lon:-43.3460, cam:false, camLive:false, depth_m:2.0,
   desc:'Spot mais icônico do Rio, em homenagem ao pioneiro Pepê. Ventos de E/SE de 10–18 kn entre setembro e fevereiro; estrutura completa com escolas e barco de apoio.'},
  {id:18, name:'Posto 7 — K7',              short:'Posto 7',       slug:'posto-7',          region:'Barra da Tijuca, RJ',    state:'rj', fav:false, lat:-23.0004, lon:-43.3659, cam:false, camLive:false, depth_m:2.0,
   desc:'Área oficial de kite na Barra da Tijuca com 150 metros de faixa autorizada. Spot mais regulamentado do Rio, com escolas credenciadas e condições de vento consistentes.'},
  {id:19, name:'Praia da Macumba',           short:'Macumba',       slug:'praia-da-macumba', region:'Recreio, RJ',            state:'rj', fav:false, lat:-23.0185, lon:-43.4470, cam:false, camLive:false, depth_m:2.0,
   desc:'Praia entre Barra e Recreio com ondas consistentes e vento SE direto do Atlântico. Menos lotada que Pepê; boas condições de surf e kite com correntes litorâneas moderadas.'},
  {id:20, name:'Grumari',                    short:'Grumari',       slug:'grumari',          region:'Guaratiba, RJ',          state:'rj', fav:false, lat:-23.0500, lon:-43.5333, cam:false, camLive:false, depth_m:1.5,
   desc:'Praia preservada no extremo oeste do Rio, dentro de área de proteção ambiental. Ventos fortes e constantes, mar aberto e quase nenhuma aglomeração — spot para riders experientes.'},
  // Rio Grande do Norte, Brazil
  {id:21, name:'Três Picos — S. M. Gostoso',  short:'Três Picos',    slug:'tres-picos',       region:'S. M. do Gostoso, RN',   state:'rn', fav:true,  lat:-5.0983, lon:-35.6462, cam:false, camLive:false, depth_m:1.2,
   desc:'Ponta noroeste de São Miguel do Gostoso, um dos melhores spots de kite do Nordeste. Ventos alísios de E/SE de 18–28 kn de agosto a janeiro; águas rasas, fundo de areia e ondas de porte médio.'},
  {id:22, name:'Ilha do Fogo — Parrachos',     short:'Ilha do Fogo',  slug:'ilha-do-fogo',     region:'Macau, RN',              state:'rn', fav:false, lat:-5.0708, lon:-36.4850, cam:false, camLive:false, depth_m:0.8,
   desc:'Ilha barreira na costa do Macau com parrachos rasos protegidos da ondulação oceânica. Água plana e transparente, fundo de recife de coral a 0.5–1 m; ventos constantes de E/SE ideais para freestyle e foil.'},
  {id:23, name:'Galinhos',                     short:'Galinhos',      slug:'galinhos',         region:'Galinhos, RN',           state:'rn', fav:false, lat:-5.1000, lon:-36.2537, cam:false, camLive:false, depth_m:1.0,
   desc:'Península de areia fina em meio a manguezais e lagoas salobras. Ventos de E/SE acima de 20 kn na temporada de agosto a fevereiro; lâmina d\'água plana nas lagoas e downwinder longo para Galinhos.'},
  // Rio de Janeiro — other
  {id:24, name:'Búzios — Praia Rasa',          short:'Búzios',        slug:'buzios',           region:'Búzios, RJ',             state:'rj', fav:false, lat:-22.7419, lon:-41.9244, cam:false, camLive:false, depth_m:2.0,
   desc:'Praia Rasa em Cabo Frio/Búzios, exposta aos ventos de E/NE. Águas azuis e quentes, boa amplitude de maré e vento consistente na tarde; indicado para riders intermediários e avançados.'},
  {id:25, name:'Arraial do Cabo — Praia Grande',short:'Arraial',       slug:'arraial-do-cabo',  region:'Arraial do Cabo, RJ',    state:'rj', fav:false, lat:-22.9697, lon:-42.0272, cam:false, camLive:false, depth_m:2.5,
   desc:'Extensa faixa de areia branca no extremo do Cabo Frio. Ventos fortes de E/SE constantes; ressurgência de água fria (18–22 °C) torna o spot único no litoral fluminense.'},
  {id:26, name:'Lagoa de Araruama',             short:'Araruama',      slug:'lagoa-araruama',   region:'Araruama, RJ',           state:'rj', fav:false, lat:-22.8900, lon:-42.3400, cam:false, camLive:false, depth_m:1.5,
   desc:'Maior lagoa hipersalina do mundo; água plana garantida e ventos de E/SE canalizados entre as serras. Ideal para iniciantes e freestyle; múltiplos acessos pela orla da lagoa.'},
  // Santa Catarina, Brazil
  {id:27, name:'Ibiraquera — Lagoa',            short:'Ibiraquera',    slug:'ibiraquera',       region:'Imbituba, SC',           state:'scbr', fav:false, lat:-28.2383, lon:-48.7917, cam:false, camLive:false, depth_m:1.2,
   desc:'Lagoa costeira entre Imbituba e Garopaba com ventos de S/SW coletados pelas frentes frias. Água doce e plana; temporada de inverno (maio–setembro) com rajadas acima de 25 kn.'},
  {id:28, name:'Garopaba — Praia do Ferrugem',  short:'Garopaba',      slug:'garopaba',         region:'Garopaba, SC',           state:'scbr', fav:false, lat:-28.0433, lon:-48.6200, cam:false, camLive:false, depth_m:2.0,
   desc:'Enseada atlântica protegida em Garopaba com ventos do quadrante sul de 20–35 kn no inverno. Ondas de porte médio e saída pela lagoa do Ferrugem; spot para riders com experiência em surf kite.'},
  // Ceará, Brazil
  {id:29, name:'Jericoacoara',                  short:'Jeri',          slug:'jericoacoara',     region:'Jericoacoara, CE',       state:'ce',   fav:true,  lat:-2.7974, lon:-40.5128, cam:false, camLive:false, depth_m:1.5,
   desc:'Um dos destinos de kitesurf mais icônicos do mundo. Ventos alísios de E/NE de 20–35 kn de julho a janeiro; dunas, lagoas e ondas perfeitas no Ponta Idonéia. Estrutura completa de escolas e lojas.'},
  {id:30, name:'Guajiru',                       short:'Guajiru',       slug:'guajiru',          region:'Trairi, CE',             state:'ce',   fav:false, lat:-3.2733, lon:-39.2783, cam:false, camLive:false, depth_m:1.0,
   desc:'Vila de pescadores com lagoas rasas e ventos fortes de E/SE. Água plana nas maré baixa, areia branca e muito menos movimento que Jeri; favorito de riders que buscam condições naturais sem multidão.'},
  {id:31, name:'Paracuru',                      short:'Paracuru',      slug:'paracuru',         region:'Paracuru, CE',           state:'ce',   fav:false, lat:-3.4117, lon:-39.0503, cam:false, camLive:false, depth_m:2.0,
   desc:'Costa aberta com vento alísio de E/NE acima de 20 kn na temporada. Famoso pelo wave-kite com ondas de 1–2 m e praia ampla; sedia etapas do campeonato brasileiro.'},
  {id:32, name:'Barrinha',                      short:'Barrinha',      slug:'barrinha',         region:'Paracuru, CE',           state:'ce',   fav:false, lat:-3.3833, lon:-39.0667, cam:false, camLive:false, depth_m:1.0,
   desc:'Pequena lagoa atrás da duna entre Paracuru e Lagoinha. Água rasa e plana com fundo de areia; vento acelerado pela topografia das dunas — ideal para freestyle e progressão.'},
];

/* ── SPOTS ARRAY (weather fields start as zeroed, filled by realtime.js) ── */
let SPOTS = SPOTS_CONFIG.map(c => ({
  ...c,                           // includes desc, depth_m, lat, lon, etc.
  camUrl: c.camUrl ?? null, localUrl: c.localUrl ?? null,
  isPrivate: c.isPrivate ?? false,
  score:0, status:'nogo', wind:0, gusts:0,
  dir:'—', dirDeg:0,
  airC:null, waterC:null, waves:null, period:null,
  rain:0, tide:'—', sunrise:null, sunset:null,
  goodStart:null, goodEnd:null,
  hours:[], windows:[], allW:[], hr:[],
  week:[
    {d:'Mon',kn:0,s:'nogo'},{d:'Tue',kn:0,s:'nogo'},{d:'Wed',kn:0,s:'nogo'},
    {d:'Thu',kn:0,s:'nogo'},{d:'Fri',kn:0,s:'nogo'},{d:'Sat',kn:0,s:'nogo'},{d:'Sun',kn:0,s:'nogo'},
  ],
}));

/* ── GLOBAL UI STATE ── */
let activeId = 0, filter = 'all', tempUnit = 'C', layer = 'sat', tilt = false, dpTab = 'today', dpOpen = false;
let bpTab = 'pro', bpOpen = true, bpH = (window.innerHeight < 800 ? 220 : 300), bpShowLegend = true;
let bpLabelSide = localStorage.getItem('wsp_bp_side') || 'left';
let bpFontSize  = parseInt(localStorage.getItem('wsp_bp_fs') || '10');
let selectedHourData = null;  // hour selected in Forecast panel
let selHidx = null;           // column index of that selection
