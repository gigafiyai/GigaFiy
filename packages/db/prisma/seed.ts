import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ShowSeed = {
  id: string;
  date: string; // ISO Z, local clock time embedded (dev convenience)
  dayOfWeek: string;
  city: string;
  state: string;
  venueName: string;
  address: string;
  lat: number;
  lng: number;
  timeStart: string | null;
  timeEnd: string | null;
  showType: "festival" | "market" | "headline";
};

const SHOWS: ShowSeed[] = [
  // June
  {
    id: "show_jun06_newton",
    date: "2026-06-06T14:00:00Z",
    dayOfWeek: "Saturday",
    city: "Newton",
    state: "MA",
    venueName: "Newton Porchfest",
    address: "Newton, MA",
    lat: 42.337,
    lng: -71.209,
    timeStart: "2026-06-06T14:00:00Z",
    timeEnd: "2026-06-06T16:00:00Z",
    showType: "festival",
  },
  {
    id: "show_jun13_danbury",
    date: "2026-06-13T12:00:00Z",
    dayOfWeek: "Saturday",
    city: "Danbury",
    state: "CT",
    venueName: "Danbury Street Festival",
    address: "Danbury, CT",
    lat: 41.394,
    lng: -73.454,
    timeStart: "2026-06-13T12:00:00Z",
    timeEnd: "2026-06-13T12:45:00Z",
    showType: "festival",
  },
  {
    id: "show_jun20_millerton",
    date: "2026-06-20T11:00:00Z",
    dayOfWeek: "Saturday",
    city: "Millerton",
    state: "NY",
    venueName: "Millerton Farmers Market",
    address: "Millerton, NY",
    lat: 41.951,
    lng: -73.510,
    timeStart: "2026-06-20T11:00:00Z",
    timeEnd: "2026-06-20T13:00:00Z",
    showType: "market",
  },
  {
    id: "show_jun21_hartford_vt",
    date: "2026-06-21T10:30:00Z",
    dayOfWeek: "Sunday",
    city: "Hartford",
    state: "VT",
    venueName: "Quechee Balloon Festival",
    address: "Quechee, Hartford, VT",
    lat: 43.654,
    lng: -72.394,
    timeStart: "2026-06-21T10:30:00Z",
    timeEnd: "2026-06-21T12:00:00Z",
    showType: "festival",
  },

  // July
  {
    id: "show_jul04_gtbarrington",
    date: "2026-07-04T18:30:00Z",
    dayOfWeek: "Saturday",
    city: "Great Barrington",
    state: "MA",
    venueName: "Berkshire Busk",
    address: "Great Barrington, MA",
    lat: 42.196,
    lng: -73.362,
    timeStart: "2026-07-04T18:30:00Z",
    timeEnd: "2026-07-04T20:30:00Z",
    showType: "festival",
  },
  {
    id: "show_jul09_trumbull",
    date: "2026-07-09T16:00:00Z",
    dayOfWeek: "Thursday",
    city: "Trumbull",
    state: "CT",
    venueName: "Trumbull Farmers Market",
    address: "Trumbull, CT",
    lat: 41.243,
    lng: -73.200,
    timeStart: "2026-07-09T16:00:00Z",
    timeEnd: "2026-07-09T19:00:00Z",
    showType: "market",
  },
  {
    id: "show_jul17_cambridge_middleeast",
    date: "2026-07-17T17:00:00Z",
    dayOfWeek: "Friday",
    city: "Cambridge",
    state: "MA",
    venueName: "Middle East Club",
    address: "472 Massachusetts Ave, Cambridge, MA",
    lat: 42.373,
    lng: -71.110,
    timeStart: "2026-07-17T17:00:00Z",
    timeEnd: "2026-07-17T20:00:00Z",
    showType: "headline",
  },
  {
    id: "show_jul18_litchfield",
    date: "2026-07-18T10:00:00Z",
    dayOfWeek: "Saturday",
    city: "Litchfield",
    state: "CT",
    venueName: "Litchfield Farmers Market",
    address: "Litchfield, CT",
    lat: 41.748,
    lng: -73.190,
    timeStart: "2026-07-18T10:00:00Z",
    timeEnd: "2026-07-18T13:00:00Z",
    showType: "market",
  },
  {
    id: "show_jul23_newpaltz",
    date: "2026-07-23T19:30:00Z",
    dayOfWeek: "Thursday",
    city: "New Paltz",
    state: "NY",
    venueName: "The Lemon Squeeze",
    address: "New Paltz, NY",
    lat: 41.747,
    lng: -74.083,
    timeStart: "2026-07-23T19:30:00Z",
    timeEnd: "2026-07-23T22:00:00Z",
    showType: "headline",
  },
  {
    id: "show_jul25_pittsfield",
    date: "2026-07-25T10:00:00Z",
    dayOfWeek: "Saturday",
    city: "Pittsfield",
    state: "MA",
    venueName: "Pittsfield Farmers Market",
    address: "Pittsfield, MA",
    lat: 42.451,
    lng: -73.245,
    timeStart: "2026-07-25T10:00:00Z",
    timeEnd: "2026-07-25T12:00:00Z",
    showType: "market",
  },
  {
    id: "show_jul25_gtbarrington",
    date: "2026-07-25T18:30:00Z",
    dayOfWeek: "Saturday",
    city: "Great Barrington",
    state: "MA",
    venueName: "Berkshire Busk",
    address: "Great Barrington, MA",
    lat: 42.196,
    lng: -73.362,
    timeStart: "2026-07-25T18:30:00Z",
    timeEnd: "2026-07-25T20:30:00Z",
    showType: "festival",
  },
  {
    id: "show_jul30_newmarket",
    date: "2026-07-30T18:00:00Z",
    dayOfWeek: "Thursday",
    city: "Newmarket",
    state: "NH",
    venueName: "Stone Church",
    address: "5 Granite St, Newmarket, NH",
    lat: 43.080,
    lng: -70.935,
    timeStart: "2026-07-30T18:00:00Z",
    timeEnd: "2026-07-30T19:30:00Z",
    showType: "headline",
  },

  // August
  {
    id: "show_aug20_westport",
    date: "2026-08-20T10:00:00Z",
    dayOfWeek: "Thursday",
    city: "Westport",
    state: "CT",
    venueName: "Westport Farmers Market",
    address: "Westport, CT",
    lat: 41.142,
    lng: -73.358,
    timeStart: "2026-08-20T10:00:00Z",
    timeEnd: "2026-08-20T14:00:00Z",
    showType: "market",
  },
  {
    id: "show_aug21_cambridge_toad",
    date: "2026-08-21T18:00:00Z",
    dayOfWeek: "Friday",
    city: "Cambridge",
    state: "MA",
    venueName: "Toad",
    address: "1912 Massachusetts Ave, Cambridge, MA",
    lat: 42.387,
    lng: -71.123,
    timeStart: "2026-08-21T18:00:00Z",
    timeEnd: "2026-08-21T21:00:00Z",
    showType: "headline",
  },
  {
    id: "show_aug22_newcanaan",
    date: "2026-08-22T10:00:00Z",
    dayOfWeek: "Saturday",
    city: "New Canaan",
    state: "CT",
    venueName: "New Canaan Farmers Market",
    address: "New Canaan, CT",
    lat: 41.147,
    lng: -73.494,
    timeStart: "2026-08-22T10:00:00Z",
    timeEnd: "2026-08-22T14:00:00Z",
    showType: "market",
  },
  {
    id: "show_aug23_poughkeepsie",
    date: "2026-08-23T12:00:00Z",
    dayOfWeek: "Sunday",
    city: "Poughkeepsie",
    state: "NY",
    venueName: "Poughkeepsie Porchfest",
    address: "Poughkeepsie, NY",
    lat: 41.704,
    lng: -73.921,
    timeStart: null,
    timeEnd: null,
    showType: "festival",
  },
  {
    id: "show_aug26_northadams",
    date: "2026-08-26T18:30:00Z",
    dayOfWeek: "Wednesday",
    city: "North Adams",
    state: "MA",
    venueName: "Windsor Lake Concert",
    address: "Windsor Lake, North Adams, MA",
    lat: 42.701,
    lng: -73.109,
    timeStart: "2026-08-26T18:30:00Z",
    timeEnd: "2026-08-26T20:00:00Z",
    showType: "headline",
  },
  {
    id: "show_aug27_providence",
    date: "2026-08-27T15:00:00Z",
    dayOfWeek: "Thursday",
    city: "Providence",
    state: "RI",
    venueName: "Armory Farmers Market",
    address: "Providence, RI",
    lat: 41.824,
    lng: -71.413,
    timeStart: "2026-08-27T15:00:00Z",
    timeEnd: "2026-08-27T18:00:00Z",
    showType: "market",
  },
  {
    id: "show_aug28_sheffield",
    date: "2026-08-28T15:00:00Z",
    dayOfWeek: "Friday",
    city: "Sheffield",
    state: "MA",
    venueName: "Sheffield Farmers Market",
    address: "Sheffield, MA",
    lat: 42.105,
    lng: -73.358,
    timeStart: "2026-08-28T15:00:00Z",
    timeEnd: "2026-08-28T18:00:00Z",
    showType: "market",
  },
  {
    id: "show_aug29_litchfield",
    date: "2026-08-29T10:00:00Z",
    dayOfWeek: "Saturday",
    city: "Litchfield",
    state: "CT",
    venueName: "Litchfield Farmers Market",
    address: "Litchfield, CT",
    lat: 41.748,
    lng: -73.190,
    timeStart: "2026-08-29T10:00:00Z",
    timeEnd: "2026-08-29T13:00:00Z",
    showType: "market",
  },
  {
    id: "show_aug29_oldwethersfield",
    date: "2026-08-29T17:00:00Z",
    dayOfWeek: "Saturday",
    city: "Old Wethersfield",
    state: "CT",
    venueName: "Old Wethersfield Porchfest",
    address: "Old Wethersfield, CT",
    lat: 41.713,
    lng: -72.652,
    timeStart: "2026-08-29T17:00:00Z",
    timeEnd: "2026-08-29T18:00:00Z",
    showType: "festival",
  },
];

async function main() {
  console.log("Seeding database...");

  // Wipe in FK-safe order
  await prisma.survey.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.call.deleteMany();
  await prisma.outreach.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.show.deleteMany();
  await prisma.artist.deleteMany();

  const elijah = await prisma.artist.create({
    data: {
      id: "artist_elijah",
      name: "Elijah Stone",
      genre: "Indie Folk",
      bio: "Singer-songwriter with a roots-folk sound. Touring the Northeast — porchfests, farmers markets, and listening rooms across CT, MA, NY, NH, VT, and RI.",
      drawDescription: "80-150 weeknights, 200+ weekends in similar markets",
      spotifyUrl: "https://open.spotify.com/artist/elijahstone",
      videoReelUrl: "https://gigify.io/reels/elijah-stone-60s.mp4",
      epkUrl: "https://gigify.io/epk/elijah-stone.pdf",
      contactName: "Elijah Stone",
      contactEmail: "elijah@elijahstonemusic.com",
      contactPhone: "(734) 555-0011",
    },
  });

  for (const s of SHOWS) {
    await prisma.show.create({
      data: {
        id: s.id,
        artistId: elijah.id,
        date: new Date(s.date),
        dayOfWeek: s.dayOfWeek,
        city: s.city,
        state: s.state,
        venueName: s.venueName,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        timeStart: s.timeStart ? new Date(s.timeStart) : null,
        timeEnd: s.timeEnd ? new Date(s.timeEnd) : null,
        showType: s.showType,
        status: "CONFIRMED",
      },
    });
  }

  console.log(`Seeded ${SHOWS.length} shows for ${elijah.name}. Pipeline empty — awaiting venue discovery.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
