// const { PrismaClient } = require('@prisma/client');
// const bcrypt = require('bcryptjs');
// const prisma = new PrismaClient();

// async function main() {
//   const email = process.env.MAIN_ADMIN_EMAIL ;
//   const pass  = process.env.MAIN_ADMIN_PASSWORD ;
//   const hash  = bcrypt.hashSync(pass, 10);

//   await prisma.admin.upsert({
//     where: { email },
//     update: {},
//     create: { email, password: hash }
//   });

//   // Define all 5 buses with their routes
//   const busData = [
//     {
//       number: '101',
//       name: 'Bus 101',
//       location: 'Vijayawada',
//       morningStops: [
//         { name: 'Vijayawada Railway Station', lat: 16.5062, lng: 80.6480 },
//         { name: 'Benz Circle', lat: 16.5171, lng: 80.6305 },
//         { name: 'Prakasham Barrage', lat: 16.5200, lng: 80.6250 },
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 }
//       ],
//       eveningStops: [
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 },
//         { name: 'Prakasham Barrage', lat: 16.5200, lng: 80.6250 },
//         { name: 'Benz Circle', lat: 16.5171, lng: 80.6305 },
//         { name: 'Vijayawada Railway Station', lat: 16.5062, lng: 80.6480 }
//       ]
//     },
//     {
//       number: '102',
//       name: 'Bus 102',
//       location: 'Guntur',
//       morningStops: [
//         { name: 'Guntur Railway Station', lat: 16.3008, lng: 80.4428 },
//         { name: 'Amaravati Road', lat: 16.3500, lng: 80.5000 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'Amaravati', lat: 16.4500, lng: 80.6000 },
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 }
//       ],
//       eveningStops: [
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 },
//         { name: 'Amaravati', lat: 16.4500, lng: 80.6000 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'Amaravati Road', lat: 16.3500, lng: 80.5000 },
//         { name: 'Guntur Railway Station', lat: 16.3008, lng: 80.4428 }
//       ]
//     },
//     {
//       number: '103',
//       name: 'Bus 103',
//       location: 'Kanuru',
//       morningStops: [
//         { name: 'Kanuru Junction', lat: 16.5200, lng: 80.6200 },
//         { name: 'NTR Circle', lat: 16.5250, lng: 80.6300 },
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 }
//       ],
//       eveningStops: [
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 },
//         { name: 'NTR Circle', lat: 16.5250, lng: 80.6300 },
//         { name: 'Kanuru Junction', lat: 16.5200, lng: 80.6200 }
//       ]
//     },
//     {
//       number: '104',
//       name: 'Bus 104',
//       location: 'Machilipatnam',
//       morningStops: [
//         { name: 'Machilipatnam Bus Stand', lat: 16.1667, lng: 81.1333 },
//         { name: 'Gudivada', lat: 16.2500, lng: 80.9000 },
//         { name: 'Nuzvid', lat: 16.3500, lng: 80.7500 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 }
//       ],
//       eveningStops: [
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'Nuzvid', lat: 16.3500, lng: 80.7500 },
//         { name: 'Gudivada', lat: 16.2500, lng: 80.9000 },
//         { name: 'Machilipatnam Bus Stand', lat: 16.1667, lng: 81.1333 }
//       ]
//     },
//     {
//       number: '105',
//       name: 'Bus 105',
//       location: 'Eluru',
//       morningStops: [
//         { name: 'Eluru Railway Station', lat: 16.7000, lng: 81.1000 },
//         { name: 'Gudivada', lat: 16.2500, lng: 80.9000 },
//         { name: 'Nuzvid', lat: 16.3500, lng: 80.7500 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 }
//       ],
//       eveningStops: [
//         { name: 'V R Siddhartha Engineering College', lat: 16.5286, lng: 80.6393 },
//         { name: 'Mangalagiri', lat: 16.4000, lng: 80.5500 },
//         { name: 'Nuzvid', lat: 16.3500, lng: 80.7500 },
//         { name: 'Gudivada', lat: 16.2500, lng: 80.9000 },
//         { name: 'Eluru Railway Station', lat: 16.7000, lng: 81.1000 }
//       ]
//     }
//   ];

//   // Create buses and their stops
//   for (const busInfo of busData) {
//     const bus = await prisma.bus.upsert({
//       where: { number: busInfo.number },
//       update: {},
//       create: {
//         number: busInfo.number,
//         name: busInfo.name,
//         location: busInfo.location,
//         capacity: 60,
//         currentOccupancy: 0
//       }
//     });

//     // Clear existing stops for this bus
//     await prisma.stop.deleteMany({ where: { busId: bus.id } });

//     // Add morning stops
//     for (let i = 0; i < busInfo.morningStops.length; i++) {
//       const stop = busInfo.morningStops[i];
//       await prisma.stop.create({
//         data: {
//           name: stop.name,
//           lat: stop.lat,
//           lng: stop.lng,
//           period: 'MORNING',
//           order: i + 1,
//           busId: bus.id
//         }
//       });
//     }

//     // Add evening stops
//     for (let i = 0; i < busInfo.eveningStops.length; i++) {
//       const stop = busInfo.eveningStops[i];
//       await prisma.stop.create({
//         data: {
//           name: stop.name,
//           lat: stop.lat,
//           lng: stop.lng,
//           period: 'EVENING',
//           order: i + 1,
//           busId: bus.id
//         }
//       });
//     }
//   }

//   console.log('✅ Seeded 5 buses with complete routes');
// }

// main().then(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exit(1);});

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding relational Bus & Stop data...");

  // Clear existing data safely
  await prisma.stop.deleteMany();
  await prisma.bus.deleteMany();

  // Sample buses
  const buses = [
    {
      number: "1",
      name: "Vijayawada City Express",
      location: "Benz Circle",
      capacity: 40,
      currentOccupancy: 25,
      driverName: "Ravi Kumar",
      driverPhone: "9876543210",
      liveLocationUrl: "",
      stops: [
        // Morning route
        { name: "Benz Circle", lat: 16.5062, lng: 80.6480, period: "MORNING", order: 1 },
        { name: "Auto Nagar", lat: 16.4893, lng: 80.6765, period: "MORNING", order: 2 },
        { name: "VR Siddhartha Engineering College", lat: 16.4956, lng: 80.7158, period: "MORNING", order: 3 },
        // Evening route
        { name: "VR Siddhartha Engineering College", lat: 16.4956, lng: 80.7158, period: "EVENING", order: 1 },
        { name: "Auto Nagar", lat: 16.4893, lng: 80.6765, period: "EVENING", order: 2 },
        { name: "Benz Circle", lat: 16.5062, lng: 80.6480, period: "EVENING", order: 3 },
      ],
    },
    {
      number: "2",
      name: "Guntur Route",
      location: "Guntur Bus Stand",
      capacity: 45,
      currentOccupancy: 32,
      driverName: "Prasad Reddy",
      driverPhone: "9876501234",
      liveLocationUrl: "",
      stops: [
        // Morning route
        { name: "Guntur Bus Stand", lat: 16.3067, lng: 80.4365, period: "MORNING", order: 1 },
        { name: "Mangalagiri", lat: 16.4320, lng: 80.5573, period: "MORNING", order: 2 },
        { name: "VR Siddhartha Engineering College", lat: 16.4956, lng: 80.7158, period: "MORNING", order: 3 },
        // Evening route
        { name: "VR Siddhartha Engineering College", lat: 16.4956, lng: 80.7158, period: "EVENING", order: 1 },
        { name: "Mangalagiri", lat: 16.4320, lng: 80.5573, period: "EVENING", order: 2 },
        { name: "Guntur Bus Stand", lat: 16.3067, lng: 80.4365, period: "EVENING", order: 3 },
      ],
    },
  ];

  for (const bus of buses) {
    await prisma.bus.create({
      data: {
        number: bus.number,
        name: bus.name,
        location: bus.location,
        capacity: bus.capacity,
        currentOccupancy: bus.currentOccupancy,
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        liveLocationUrl: bus.liveLocationUrl,
        stops: {
          create: bus.stops.map(stop => ({
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            period: stop.period,
            order: stop.order,
          })),
        },
      },
    });
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
