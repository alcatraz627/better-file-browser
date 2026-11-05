// What each part of Tokyo and its day-trip towns is like, and what is on there
// during one trip: Thu 12 to Tue 17 November 2026. Written by hand from the
// sources linked on each event, so nothing is fetched. Another trip means
// replacing this file.

export type AreaKind = 'market' | 'temple' | 'night' | 'shop' | 'culture' | 'pop' | 'nature';

export interface TripEvent {
  name: string;
  /** First and last day, as YYYY-MM-DD. A long run keeps its real dates, past the trip. */
  start: string;
  end: string;
  note: string;
  hours?: string;
  source: string;
  /** False when the dates come from a yearly pattern and no page states this year's. */
  sure: boolean;
}

export interface Area {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Strongest first; the first one colours the area. */
  kinds: AreaKind[];
  /** A few words for the label on the map. */
  tag: string;
  feel: string;
  events: TripEvent[];
}

export const TRIP_LABEL = 'Nov 12 to 17';

export const KIND_ORDER: AreaKind[] = ['market', 'temple', 'night', 'shop', 'culture', 'pop', 'nature'];

export const KIND_WORD: Record<AreaKind, string> = {
  market: 'Food', temple: 'Temples', night: 'Night', shop: 'Shops',
  culture: 'Art', pop: 'Fun', nature: 'Nature',
};

export const KIND_COLOUR: Record<AreaKind, string> = {
  market: '#d97706', temple: '#7c3aed', night: '#db2777', shop: '#2563eb',
  culture: '#0d9488', pop: '#0891b2', nature: '#16a34a',
};

const TOKYO_DOME = 'https://www.tokyo-dome.co.jp/dome/event/schedule.html';
const HIBIYA_RELEASE = 'https://digitalpr.jp/r/147082';
const AUTUMN_LISTING = 'https://www.enjoytokyo.jp/feature/matsuri_autumn/cal_nov_tokyo/';
const LIGHTS_LISTING = 'https://www.enjoytokyo.jp/feature/illumi/';
const GARDEN_PLACE = 'https://gardenplace.jp/';

// In order of how much a first-time visitor is likely to care: when labels
// collide as the map zooms out, the earlier one stays.
export const AREAS: Area[] = [
  {
    id: 'shinjuku', name: 'Shinjuku', lat: 35.692, lng: 139.702, radiusM: 1100,
    kinds: ['night', 'shop', 'market', 'nature'], tag: 'neon, big station, bars',
    feel: 'Skyscrapers and the busiest station in the world on one side, tiny bars and neon on the other.',
    events: [{
      name: 'Ra-1 Grand Prix ramen battle', start: '2026-10-10', end: '2026-11-15',
      note: 'Ramen shops compete at Okubo Park and visitors vote. The final round runs Nov 13 to 15.', hours: '11:00 to 21:00',
      source: AUTUMN_LISTING, sure: true,
    }],
  },
  {
    id: 'shibuya', name: 'Shibuya', lat: 35.658, lng: 139.702, radiusM: 800,
    kinds: ['shop', 'night', 'market'], tag: 'scramble, fashion, young crowd',
    feel: 'The famous scramble crossing, fashion towers and a young, loud crowd.',
    events: [],
  },
  {
    id: 'asakusa', name: 'Asakusa', lat: 35.714, lng: 139.797, radiusM: 900,
    kinds: ['temple', 'market', 'shop'], tag: 'old Tokyo, temple, stalls',
    feel: 'Old-Tokyo tourist district around a big red-lantern temple gate and a long shopping lane. Busy by day, quiet at night.',
    events: [],
  },
  {
    id: 'ueno', name: 'Ueno', lat: 35.712, lng: 139.775, radiusM: 900,
    kinds: ['culture', 'market', 'nature'], tag: 'museums, park, bazaar',
    feel: 'A big park full of museums and a zoo, with a crowded bazaar street under the tracks by the station.',
    events: [{
      name: 'Tokyo Christmas Advent', start: '2026-11-06', end: '2026-12-25',
      note: 'Food huts and lights in Ueno Park.', hours: '12:00 to 23:00',
      source: 'https://prtimes.jp/main/html/rd/p/000000001.000192190.html', sure: true,
    }],
  },
  {
    id: 'marunouchi', name: 'Tokyo Station', lat: 35.681, lng: 139.767, radiusM: 800,
    kinds: ['shop', 'culture'], tag: 'brick station, offices, palace',
    feel: 'Brick station and glass towers facing the Imperial Palace moat, with orderly streets and many shops underground.',
    events: [{
      name: 'Marunouchi Illumination', start: '2026-11-12', end: '2027-02-14',
      note: 'Free winter lights along Naka-dori and in front of the station.', hours: '16:00 to 23:00',
      source: 'https://www.gotokyo.org/en/spot/ev002/index.html', sure: true,
    }, {
      name: 'Harry Potter "magical snow" display', start: '2026-11-12', end: '2026-12-25',
      note: 'Winter display on the Marunouchi Building and nearby. Some content is left out on some days.',
      source: LIGHTS_LISTING, sure: true,
    }],
  },
  {
    id: 'ginza', name: 'Ginza', lat: 35.672, lng: 139.765, radiusM: 700,
    kinds: ['shop', 'culture', 'market'], tag: 'department stores, polished',
    feel: 'Polished department stores, galleries and expensive restaurants in a tidy grid.',
    events: [],
  },
  {
    id: 'akihabara', name: 'Akihabara', lat: 35.698, lng: 139.773, radiusM: 600,
    kinds: ['pop', 'shop'], tag: 'anime, electronics, arcades',
    feel: 'Neon-lit streets of electronics, anime shops, arcades and maid cafes around the station.',
    events: [],
  },
  {
    id: 'harajuku', name: 'Harajuku', lat: 35.668, lng: 139.708, radiusM: 900,
    kinds: ['shop', 'temple', 'nature'], tag: 'street fashion, forest shrine',
    feel: 'Teen street fashion and crepes in one lane, a calm boulevard of designer shops in the next, beside a huge forested shrine.',
    events: [{
      name: 'Fiesta de Espana', start: '2026-11-14', end: '2026-11-15',
      note: 'Spanish food, music and flamenco in Yoyogi Park. Free. Ends at 19:00 on Sunday.', hours: '10:00 to 20:00',
      source: 'https://spainfes.com/', sure: true,
    }, {
      name: 'Yoyogi Forest of Lights', start: '2026-11-13', end: '2027-01-11',
      note: 'Walk-through light forest in Yoyogi Park. Advance timed tickets only, from 2,400 yen.', hours: '17:30 to 22:00',
      source: 'https://www.yoyogiforestoflights.tokyo/', sure: true,
    }, {
      name: 'Shichi-Go-San at Meiji Shrine', start: '2026-11-14', end: '2026-11-15',
      note: 'Children aged 3, 5 and 7 visit in kimono. Nov 15 is the traditional day and falls on a Sunday, so this should be the busiest weekend.',
      source: 'https://kaibutsu-blog.com/shichigosan-2026-guide/', sure: false,
    }],
  },
  {
    id: 'roppongi', name: 'Roppongi', lat: 35.663, lng: 139.731, radiusM: 800,
    kinds: ['night', 'culture', 'shop'], tag: 'clubs, big art museums',
    feel: 'Late-night clubs and international bars next to two big art and shopping complexes.',
    events: [{
      name: 'Roppongi Hills Christmas lights', start: '2026-11-05', end: '2026-12-25',
      note: 'A free 400 m tree-lined street of lights on Keyakizaka. More lights start Nov 13.', hours: '17:00 to 22:00',
      source: 'https://www.roppongihills.com/', sure: true,
    }],
  },
  {
    id: 'hibiya', name: 'Hibiya', lat: 35.675, lng: 139.756, radiusM: 500,
    kinds: ['culture', 'nature', 'shop'], tag: 'park, theatres, lights',
    feel: 'A central park and theatre district between Ginza and the palace, calm and well kept.',
    events: [{
      name: 'Hibiya Magic Time Illumination', start: '2026-11-12', end: '2027-02-28',
      note: 'Avengers-themed tree at Tokyo Midtown Hibiya, with a show every 30 minutes until 22:30.', hours: '16:00 to 23:00',
      source: HIBIYA_RELEASE, sure: true,
    }, {
      name: 'Hibiya Park pond light-up', start: '2026-11-12', end: '2026-12-20',
      note: 'Shinji Pond lit up inside the park.', hours: '17:00 to 22:00',
      source: HIBIYA_RELEASE, sure: true,
    }, {
      name: 'Imperial Hotel illumination', start: '2026-11-14', end: '2027-02-14',
      note: 'Outdoor winter lights at the hotel.', hours: '17:00 to 24:00',
      source: HIBIYA_RELEASE, sure: true,
    }],
  },
  {
    id: 'tsukiji', name: 'Tsukiji', lat: 35.666, lng: 139.771, radiusM: 450,
    kinds: ['market'], tag: 'seafood stalls, sushi',
    feel: 'Cramped lanes of seafood stalls and sushi counters at the edge of the old fish market.',
    events: [],
  },
  {
    id: 'odaiba', name: 'Odaiba', lat: 35.628, lng: 139.78, radiusM: 2000,
    kinds: ['nature', 'shop', 'pop', 'culture'], tag: 'bay island, malls, skyline',
    feel: 'A man-made bay island of malls and a giant robot statue with skyline views, spread out and breezy.',
    events: [{
      name: 'ARTE TOKYO arts festival', start: '2026-10-10', end: '2026-12-31',
      note: 'City-run arts festival on the waterfront. Each programme has its own dates, so check the one you want.',
      source: AUTUMN_LISTING, sure: true,
    }],
  },
  {
    id: 'ariake', name: 'Ariake', lat: 35.63, lng: 139.794, radiusM: 700,
    kinds: ['culture', 'shop'], tag: 'Big Sight, exhibitions',
    feel: 'Wide waterfront streets of exhibition halls and arenas, empty unless a big event is on.',
    events: [{
      name: 'Design Festa vol.64', start: '2026-11-14', end: '2026-11-15',
      note: 'Huge open-entry art and design fair at Tokyo Big Sight, with thousands of independent artists selling their work.', hours: '10:00 to 18:00',
      source: 'https://designfesta.com/', sure: true,
    }],
  },
  {
    id: 'suidobashi', name: 'Tokyo Dome', lat: 35.706, lng: 139.752, radiusM: 700,
    kinds: ['pop', 'nature'], tag: 'stadium, rides, old garden',
    feel: 'A stadium and amusement complex in the middle of the city, beside one of its oldest landscape gardens.',
    events: [{
      name: 'Asia Pro Baseball Championship', start: '2026-11-12', end: '2026-11-15',
      note: 'Four-nation tournament. Japan plays Nov 12, 13 and 14, and the final is Sunday at 19:00.',
      source: 'https://npb.jp/apbc/2026/', sure: true,
    }, {
      name: 'Tohji "Tokyo MALL" concert', start: '2026-11-17', end: '2026-11-17',
      note: 'One-night Tokyo Dome show. Doors open at 16:00 and the show starts at 18:00.',
      source: TOKYO_DOME, sure: true,
    }, {
      name: 'Koishikawa Korakuen night opening', start: '2026-11-13', end: '2026-11-24',
      note: 'An Edo-period garden with autumn trees lit at night. Tickets 1,000 to 1,200 yen.', hours: '18:00 to 21:00',
      source: 'https://sp.jorudan.co.jp/leaf/news/jrd_260911_1.html', sure: true,
    }],
  },
  {
    id: 'ebisu', name: 'Ebisu', lat: 35.646, lng: 139.704, radiusM: 1000,
    kinds: ['night', 'market', 'shop'], tag: 'canal cafes, good dining',
    feel: 'A canal lined with cafes and boutiques, next to a polished dining and bar district around a garden plaza.',
    events: [{
      name: 'Baccarat Eternal Lights', start: '2026-11-14', end: '2027-01-11',
      note: 'Chandelier-style display on the plaza of Yebisu Garden Place.',
      source: GARDEN_PLACE, sure: true,
    }, {
      name: 'Garden Place Christmas Marche', start: '2026-11-14', end: '2026-12-25',
      note: 'Christmas stalls and lights. From noon on Sunday Nov 15.', hours: 'Evenings 17:00 to 20:00',
      source: GARDEN_PLACE, sure: true,
    }],
  },
  {
    id: 'shimokita', name: 'Shimokitazawa', lat: 35.661, lng: 139.668, radiusM: 500,
    kinds: ['shop', 'night'], tag: 'vintage, live music',
    feel: 'A tangle of small lanes with second-hand clothes, record shops and live-music bars.',
    events: [],
  },
  {
    id: 'oshiage', name: 'Skytree', lat: 35.71, lng: 139.811, radiusM: 600,
    kinds: ['shop', 'pop', 'temple'], tag: 'tower, mall, aquarium',
    feel: 'A very tall tower rising from a shopping complex, with an old low-rise neighbourhood close by.',
    events: [{
      name: 'Skytree Town Dream Christmas', start: '2026-11-05', end: '2026-12-25',
      note: 'Seasonal lights and decorations around the tower.',
      source: 'https://www.tokyo-skytree.jp/', sure: true,
    }],
  },
  {
    id: 'yanaka', name: 'Yanaka', lat: 35.725, lng: 139.765, radiusM: 800,
    kinds: ['temple', 'market'], tag: 'quiet, old lanes, temples',
    feel: 'A quiet old neighbourhood of low houses, temples and a small shopping street that largely escaped wartime damage.',
    events: [],
  },
  {
    id: 'ikebukuro', name: 'Ikebukuro', lat: 35.73, lng: 139.711, radiusM: 800,
    kinds: ['shop', 'pop', 'market'], tag: 'malls, anime, cheap eats',
    feel: 'A big station-centred mall district with anime shops, game centres and cheap eats.',
    events: [],
  },
  {
    id: 'kuramae', name: 'Kuramae', lat: 35.692, lng: 139.796, radiusM: 1400,
    kinds: ['culture', 'shop', 'nature'], tag: 'crafts, coffee, garden',
    feel: 'Two quiet east-side areas: craft shops and river cafes in Kuramae, a landscape garden and coffee roasters at Kiyosumi.',
    events: [],
  },
  {
    id: 'kagurazaka', name: 'Kagurazaka', lat: 35.703, lng: 139.741, radiusM: 450,
    kinds: ['temple', 'market'], tag: 'stone lanes, French dining',
    feel: 'A hilly old geisha quarter with stone lanes, French restaurants and small shops.',
    events: [],
  },
  {
    id: 'toyosu', name: 'Toyosu', lat: 35.649, lng: 139.789, radiusM: 1000,
    kinds: ['market', 'culture', 'shop'], tag: 'fish market, digital art',
    feel: 'A reclaimed waterfront with the new fish market, a big mall and a digital-art museum.',
    events: [],
  },
  {
    id: 'koenji', name: 'Koenji', lat: 35.705, lng: 139.65, radiusM: 600,
    kinds: ['shop', 'night', 'market'], tag: 'vintage, punk bars, izakaya',
    feel: 'A scruffy, friendly neighbourhood of vintage shops, live-music bars and cheap izakaya.',
    events: [],
  },
  {
    id: 'kichijoji', name: 'Kichijoji', lat: 35.701, lng: 139.578, radiusM: 800,
    kinds: ['shop', 'nature', 'market'], tag: 'cafes, lake park',
    feel: 'A western-side town of cafes and shops beside a big lake park, and a favourite place to live.',
    events: [],
  },
  {
    id: 'kameido', name: 'Kameido', lat: 35.702, lng: 139.822, radiusM: 500,
    kinds: ['temple'], tag: 'local shrine town',
    feel: 'An everyday east-side neighbourhood known for its shrine and its seasonal flowers.',
    events: [{
      name: 'Kameido Tenjin Chrysanthemum Festival', start: '2026-10-25', end: '2026-11-23',
      note: 'Chrysanthemum show at the shrine. Free.',
      source: 'https://rurubu.jp/andmore/spot/20000067', sure: true,
    }],
  },
  {
    id: 'oi', name: 'Oi Racecourse', lat: 35.592, lng: 139.744, radiusM: 600,
    kinds: ['market', 'pop'], tag: 'flea market, light show',
    feel: 'A big racecourse on the bay, worth the trip only for what is on there.',
    events: [{
      name: 'Tokyo City Flea Market', start: '2026-11-14', end: '2026-11-15',
      note: 'Large open-air flea market in the car park. Weather or racing can change it.', hours: 'Usually 9:00 to 14:30',
      source: 'https://matcha-jp.com/jp/27816', sure: true,
    }, {
      name: 'Tokyo Mega Illumi', start: '2026-10-31', end: '2027-01-10',
      note: 'Large light show. Closed on race days, so check the calendar for your night.',
      source: LIGHTS_LISTING, sure: true,
    }],
  },
  {
    id: 'tachikawa', name: 'Tachikawa', lat: 35.708, lng: 139.396, radiusM: 1200,
    kinds: ['nature'], tag: 'huge park, ginkgo avenue',
    feel: 'A west Tokyo town about 40 minutes from Shinjuku, beside one of the largest parks in the region.',
    events: [{
      name: 'Showa Kinen Park Autumn Leaves Festival', start: '2026-10-29', end: '2026-11-29',
      note: 'Ginkgo avenue, canal and Japanese garden lit at night. The garden needs a separate evening ticket.', hours: 'Lights 16:30 to 20:30',
      source: AUTUMN_LISTING, sure: true,
    }],
  },
  {
    id: 'maihama', name: 'Maihama', lat: 35.633, lng: 139.882, radiusM: 1500,
    kinds: ['pop', 'shop'], tag: 'Disney resort',
    feel: 'The Disney resort on the bay, with two theme parks, hotels and a mall.',
    events: [{
      name: 'Disney Christmas', start: '2026-11-11', end: '2026-12-25',
      note: 'Christmas season at Disneyland and DisneySea, with a daytime parade at Disneyland.',
      source: 'https://matcha-jp.com/jp/27652', sure: true,
    }],
  },
  {
    id: 'yokohama', name: 'Yokohama', lat: 35.449, lng: 139.639, radiusM: 1500,
    kinds: ['nature', 'market', 'shop'], tag: 'harbour, Chinatown',
    feel: 'A futuristic harbour skyline and red-brick warehouses on one side, the largest Chinese quarter in Japan on the other.',
    events: [{
      name: 'Motomachi Illumination', start: '2026-11-01', end: '2027-03-01',
      note: 'Winter lights on the shopping street beside Chinatown.',
      source: 'https://visitkanagawa.jp/events/all', sure: true,
    }],
  },
  {
    id: 'kamakura', name: 'Kamakura', lat: 35.32, lng: 139.548, radiusM: 2500,
    kinds: ['temple', 'nature', 'market'], tag: 'Zen temples, giant Buddha',
    feel: 'A seaside town of Zen temples, forested hills and a giant bronze Buddha, with a small shopping lane by the station.',
    events: [],
  },
  {
    id: 'enoshima', name: 'Enoshima', lat: 35.3, lng: 139.481, radiusM: 1200,
    kinds: ['nature', 'temple', 'market'], tag: 'island, shrine, surf beach',
    feel: 'A small island with a shrine path, a lookout and seafood stalls, joined by a causeway to a surf beach.',
    events: [],
  },
  {
    id: 'hakone', name: 'Hakone', lat: 35.235, lng: 139.06, radiusM: 8000,
    kinds: ['nature', 'culture'], tag: 'onsen, crater lake, museums',
    feel: 'A mountain hot-spring region of a crater lake, ropeways, art museums and inns, spread over many stops.',
    events: [{
      name: 'Crystal Glass Pampas Grass', start: '2026-08-18', end: '2026-11-23',
      note: '300 glass pampas stalks in the Glass Forest Museum garden. The listing calls these dates planned. Last entry 17:00.',
      source: 'https://summer.walkerplus.com/odekake/detail_e/ar0314e610528/', sure: true,
    }],
  },
  {
    id: 'kawaguchiko', name: 'Kawaguchiko', lat: 35.505, lng: 138.765, radiusM: 3000,
    kinds: ['nature'], tag: 'Mt Fuji views, lake',
    feel: 'A lake town on the north side of Mt Fuji, with mountain views, lakeside walks and small museums.',
    events: [{
      name: 'Fujikawaguchiko Autumn Leaves Festival', start: '2026-11-07', end: '2026-11-29',
      note: 'Lakeside maple corridor lit at night, plus foliage spots around the lakes.', hours: 'Lights from sunset to 21:00',
      source: 'https://kyodonewsprwire.jp/release/202610208271', sure: true,
    }],
  },
  {
    id: 'nikko', name: 'Nikko', lat: 36.756, lng: 139.598, radiusM: 1500,
    kinds: ['temple', 'nature'], tag: 'gilded shrines, waterfalls',
    feel: 'A forested town of gilded shrines and temples, with waterfalls and a lake higher up the mountain.',
    events: [],
  },
];
