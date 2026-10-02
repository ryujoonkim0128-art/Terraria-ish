'use strict';
// Words. Who says what, what they want, and the story of the letter.

const fl = (k) => (k === 0 ? 'G/F' : `${k}/F`);

const LINES = {
  adult: [
    "Mind the step on the fourth floor. It isn't there.",
    'Water came back on nine. For an hour. We filled everything, even the wok.',
    "You're new. You have the look. Like you're waiting for the ceiling to fall.",
    "My son sends money from Vancouver. Vancouver! Imagine all that sky. I'd hate it.",
    "Don't lean on railings. Any railings. That's the whole advice.",
    'The pipes knock at night. That\'s just the building thinking.',
    "If you hear shouting on six, it's the Tangs. If it stops, worry.",
    'Nobody knows where anybody lives. Everybody knows everybody. Work that out.',
    'Eat something. You look like rice paper.',
    'There was a fire in Block C once. We passed buckets for three hours. Nobody even asked whose flat.',
  ],
  elder: [
    'I came here in forty-nine. I was going to stay a month.',
    "The planes used to frighten me. Now I can't sleep without them.",
    'When it rains like this the whole city hums. Listen.',
    'Sit. Sit. Nobody sits anymore.',
    'My husband built this room. Then the people above built on top of him. On top of the room, I mean.',
    "They say they'll knock it all down one day. They've been saying it since I had teeth.",
    "Up on the roof you can see the hills. Down here you can see me. I'm better looking.",
    "Light finds its way in. Not much of it. That's why we keep the bulbs on.",
  ],
  kid: [
    "I've been on every roof. Every single one!",
    "Bet you can't find the cat that lives in the drain.",
    "Ah Keung says there's a ghost on the stairs in Block {b}. It's just Old Mak.",
    'When a plane goes over you can read the writing on its belly. I read CATHAY once.',
    "Don't go down the drain ladder. The rats are as big as you. Well. Nearly.",
    'I know a shortcut. I\'m not telling.',
  ],
  noodle: ['Fifty kilos by noon. Every day. The noodles don\'t care what day it is.', 'Don\'t touch the racks. They\'re drying. Like me.', 'Flour in my lungs, flour in my hair. My wife says I\'m going grey from the inside.'],
  fishball: ["Don't ask what's in them. Eat them.", 'The smell? You stop noticing. Then you go outside and everyone else notices.', 'Ten thousand a day. I count them in my sleep.'],
  dentist: ['No licence, good price. Open wide.', 'Half the dentists in this city are in this building. The other half want to be.', 'Gold tooth? Very fashionable. Very secure. Nobody steals a tooth.'],
  clinic: ['Doctor? Close enough. Sit.', 'If you fall, come here. People fall a lot.', 'I trained in Guangzhou. Mostly.'],
  sewing: ['Hems. Hems all day.', 'Three dresses by tonight for a shop in Mong Kok. They\'ll sell them as imported.', 'The machine is older than you. It\'s also faster than you.'],
  metal: ['Mind the sparks.', 'Hinges, locks, window cages. Everyone wants a cage. Funny, isn\'t it.', "Don't stand there. That's where things fly."],
  mahjong: ['Pung!', 'Shh. Concentrating.', 'Sit down if you have money. Otherwise watch quietly.', 'The game started on Tuesday.', 'Lucky tile. Lucky tile. Ah. No.'],
  temple: ['Light one for whoever you\'re looking for.', 'The gods here are very patient. They have to be. The rent is terrible.', 'Bow first. Then complain.'],
  tea: ['Milk tea, strong. Like the walls.', 'Sit anywhere. Nowhere\'s clean.', 'Pineapple bun? No pineapple in it. Never was.'],
  grocer: ['Rice, oil, batteries, candles. Candles for the power cuts. Ha.', 'You want credit? Everybody wants credit.', 'Fresh today. Fresh-ish.'],
  barber: ['Short? Shorter? I only do two styles.', 'Sit still. The planes make my hand jump.', 'I cut the hair of three triad bosses. Same style as you\'re getting.'],
  school: ['Recite with me. No? Then sit at the back.', 'Forty children in this room in the mornings. Fewer windows than children.'],
  vendor: ['Wonton noodles. Five dollars. Best in the city, worst in the country.', 'Eat standing up. Everybody does.'],
  landlord: ['Rent is thirty. Every three days. The building doesn\'t pay for itself. It pays for me.', 'Your room is a good room. It has a ceiling. Many don\'t.', 'I see everything. I see you.'],
};
const NIGHT_LINES = ['...', 'Mm. Go to sleep.', "It's late. Even the walls are asleep.", 'Shh. The baby.'];
const PLANE_LINES = ['—!', 'Here it comes.', 'Hold the cups!', '...', 'Every eight minutes.'];
const BARKS = {
  mahjong: ['PUNG', 'CHOW', 'AIYA', 'HM'], adult: ['HM', 'AIYA', '...'], kid: ['HA', 'WAH', '!'], elder: ['...', 'HM'],
  noodle: ['HUP', '...'], fishball: ['...'], metal: ['TSK'], sewing: ['...'], tea: ['HM'], vendor: ['NOODLES', 'HOT'],
};

const ITEMS = {
  noodle: [{ name: 'a bag of noodles', icon: 'bag' }],
  fishball: [{ name: 'a tub of fishballs', icon: 'bowl' }],
  sewing: [{ name: 'a mended dress', icon: 'cloth' }],
  dentist: [{ name: 'a set of dentures', icon: 'box' }],
  clinic: [{ name: 'a bottle of medicine', icon: 'bottle' }],
  metal: [{ name: 'a new lock', icon: 'box' }],
  grocer: [{ name: 'a sack of rice', icon: 'bag' }],
  tea: [{ name: 'a flask of milk tea', icon: 'bottle' }],
  default: [{ name: 'a parcel', icon: 'box' }, { name: 'a letter', icon: 'letter' }, { name: 'a pot of soup', icon: 'bowl' }, { name: 'a radio, fixed', icon: 'box' }],
};

const CAT_NAMES = ['Mui Mui', 'Fatty', 'Lucky', 'Ah Hei', 'Tofu', 'Siu Bak'];

const JOB_TEXT = {
  deliver: (j) => `${cap(j.item.name)}. For ${j.target.name}, Block ${j.tl}, ${j.tf}. Don't drop it. They'll know.`,
  water: (j) => `The tap on our floor's been dry for a week. Bring water up from the standpipe in the alley? I'll pay ${'$' + j.reward}.`,
  cat: (j) => `Have you seen ${j.catName}? She went down. They always go down. Somewhere dark, near Block ${j.tl}.`,
  fuse: (j) => `The lights in our block are dead. The fuse box is in the drains underneath. Someone has to go down there. ${'$' + j.reward}?`,
};
const THANKS = ['Good. Here.', "You're quicker than the last one.", 'Take it. And eat something.', 'Thank you. Really.', "Hm. You didn't drop it. I'm impressed.", 'Here. Don\'t spend it on the dentist.'];

const LAM_CLUES = [
  'Lam? There are a hundred Lams in here. Siu-ying, you said? Hm. Ask around.',
  "Siu-ying... the one who buys bird seed from the grocer? She lives up. Nobody who keeps birds lives down.",
  'Pigeons need the sky. Try the roofs. The loud ones, where the planes nearly touch the antennas.',
  "Lam Siu-ying keeps her pigeons on the highest roof in the city. Block {b}. Follow the cooing.",
];

const INTRO = [
  'The bus left you at the edge of it.',
  'Three hundred buildings grown into one. No plan. No sky, mostly.',
  'You have one bag, twelve dollars, a room on the fifth floor you have never seen, and a letter for a woman named Lam Siu-ying.',
  'Nobody knows where anybody lives in here. Everybody knows everybody.',
];

const SLEEP_TEXT = [
  "Rain on the tin roof. Somebody's radio, two floors down. You sleep.",
  'A plane, then quiet, then another plane. You stop hearing them.',
  'The pipes knock. The building is thinking. You let it.',
  'Someone is frying garlic at midnight. It smells like being looked after.',
  'Ten thousand people breathing in the same dark. You are one of them.',
];
const DEATH_TEXT = [
  'You fell between the buildings. It happens. The city closed over the sound.',
  'Your legs gave out somewhere you did not know the name of.',
  'You do not remember the fall. Somebody carried you. Nobody says who.',
];

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
