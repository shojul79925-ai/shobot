// Shobot's activities: each one shows exactly what Shobot is doing right now.
// [pose, in hand, in front, floating effects, specials, hat, eyes, label]
//  - in hand / in front: an emoji, 'svg:<tool>' for a drawn tool, or 'piece' (the 3D part in its colour)
//  - label: shown under Shobot. {part} is replaced with the part's name.
const T = (pose, hand, front, fx, sp, hat, eyes, label) => ({ pose, hand, front, fx, sp, hat, eyes, label });

export const ACTS = {
  // ---------- 3D building ----------
  b_plan: T('read', '', 'svg:blueprint', '', 'idea', 'hard', 'down', 'Drawing the plan'),
  b_hammer: T('swing', 'svg:hammer', '', '', 'sparks', 'hard', 'smile', 'Hammering the {part}'),
  b_weld: T('weld', 'svg:torch', '', '', 'weld', 'weld', '', 'Welding the {part}'),
  b_wrench: T('turn', 'svg:wrench', '', '🔩', '', 'hard', 'smile', 'Tightening the {part}'),
  b_paint: T('stroke', 'svg:brush', '', '', 'paint', 'hard', 'smile', 'Painting the {part}'),
  b_carry: T('carry', '', 'piece', '', '', 'hard', 'smile', 'Carrying the {part}'),
  b_lift: T('lift', '', 'piece', '✨', '', 'hard', 'smile', 'Lifting the {part} into place'),
  b_polish: T('stroke', '🧽', '', '✨✨', '', 'hard', 'smile', 'Polishing the glass {part}'),
  b_glow: T('plug', '🔌', '', '⚡💡', '', 'hard', 'wide', 'Wiring up the glowing {part}'),
  b_saw: T('saw', '🪚', '', '🪵', '', 'hard', 'down', 'Cutting out the {part}'),
  b_drill: T('drill', '🪛', '', '🔩', 'sparks', 'hard', 'down', 'Screwing in the {part}'),
  b_bend: T('turn', '🔧', '', '〰️', '', 'hard', 'down', 'Bending the {part}'),
  b_pottery: T('stir', '', 'piece', '💫', '', 'hard', 'down', 'Shaping the {part} on the wheel'),
  b_chisel: T('dig', '⛏️', '', '🪨', 'sparks', 'hard', 'down', 'Chipping the {part}'),
  b_gem: T('spin', '💎', '', '✨💎', '', 'hard', 'wide', 'Cutting the shiny {part}'),
  b_rubber: T('pump', '', 'piece', '💨', '', 'hard', 'happy', 'Squishing the rubber {part}'),
  b_tile: T('carry', '', 'piece', '', '', 'hard', 'smile', 'Laying down the {part}'),
  b_measure: T('measure', '', '', '📏', 'tape', 'hard', 'side', 'Measuring the {part}'),
  b_glue: T('pour', '🧴', '', '💧', '', 'hard', 'down', 'Gluing on the {part}'),
  b_magnet: T('hold', '', 'piece', '⚡🧲', '', 'hard', 'wide', 'Snapping on the {part}'),
  b_wheel: T('turn', '🔧', '', '⚙️', '', 'hard', 'down', 'Fitting the {part}'),
  b_engine: T('turn', '🔧', '', '⚙️💨', 'gear', 'hard', 'down', 'Building the {part}'),
  b_window: T('stroke', '🧽', '', '✨🫧', '', 'hard', 'smile', 'Cleaning the {part}'),
  b_light: T('plug', '💡', '', '⚡✨', '', 'hard', 'wide', 'Switching on the {part}'),
  b_wing: T('saw', '✂️', '', '✨', '', 'hard', 'down', 'Cutting out the {part}'),
  b_plant: T('pour', '🚿', '', '🌱💧', '', '', 'happy', 'Growing the {part}'),
  b_door: T('drill', '🪛', '', '🚪', '', 'hard', 'down', 'Hanging the {part}'),
  b_roof: T('lift', '', 'piece', '🏠', '', 'hard', 'smile', 'Putting on the {part}'),
  b_eye: T('stroke', '🖌️', '', '👀', '', '', 'smile', 'Drawing the {part}'),
  b_flame: T('pour', '🔥', '', '🔥', '', 'hard', 'wide', 'Lighting the {part}'),
  b_flag: T('flag', '🚩', '', '✨', '', '', 'happy', 'Raising the {part}'),
  b_screen: T('tap', '', '📱', '✨', '', '', 'down', 'Switching on the {part}'),
  b_cable: T('turn', '🧵', '', '〰️', '', 'hard', 'down', 'Threading the {part}'),
  b_water: T('pour', '🪣', '', '💧💧', '', '', 'smile', 'Filling the {part}'),
  b_seat: T('carry', '', 'piece', '🪑', '', 'hard', 'smile', 'Placing the {part}'),
  b_check: T('scan', 'svg:magnifier', '', '✅', '', 'hard', 'side', 'Checking every part'),
  b_done: T('cheer', '', '', '🎉✨🎉', 'sparkle', '', 'happy', 'Finished!'),
  b_star: T('spin', '⭐', '', '✨⭐', '', '', 'happy', 'Adding the {part}'),
  b_antenna: T('drill', '🪛', '', '📡', '', 'hard', 'up', 'Fixing the {part}'),
  b_snow: T('shake', '❄️', '', '❄️❄️', '', '', 'happy', 'Making the {part} snowy'),
  b_wood: T('saw', '🪚', '', '🪵', '', 'hard', 'down', 'Sawing the wooden {part}'),
  b_metal: T('weld', 'svg:torch', '', '', 'weld', 'weld', '', 'Melting metal for the {part}'),
  b_round: T('lift', '', 'piece', '🔵', '', 'hard', 'smile', 'Rolling in the {part}'),
  b_point: T('hold', '', 'piece', '🔺', '', 'hard', 'smile', 'Adding the pointy {part}'),
  b_block: T('carry', '', 'piece', '', '', 'hard', 'smile', 'Stacking the {part}'),

  // ---------- coding ----------
  c_plan: T('write', '✏️', '📝', '', '', '', 'down', 'Planning the code'),
  c_html: T('type', '', 'svg:laptop', '', 'code', '', 'down', 'Building the page'),
  c_css: T('stroke', '🖌️', 'svg:laptop', '🎨✨', '', '', 'smile', 'Styling it with CSS'),
  c_js: T('type', '', 'svg:laptop', '⚡', 'code', '', 'down', 'Writing JavaScript'),
  c_game: T('type', '', 'svg:laptop', '🎮👾', 'code', '', 'down', 'Making the game loop'),
  c_canvas: T('stroke', '🖌️', 'svg:laptop', '🖼️', '', '', 'smile', 'Drawing the game screen'),
  c_sound: T('listen', '', 'svg:laptop', '🔊🎵', '', 'band', 'smile', 'Adding sound effects'),
  c_test: T('scan', 'svg:magnifier', 'svg:laptop', '🧪', '', '', 'side', 'Testing my code'),
  c_bug: T('scan', 'svg:magnifier', 'svg:bug', '🐞', '', '', 'wide', 'Hunting a bug'),
  c_fix: T('drill', '🔧', 'svg:laptop', '🔧✨', '', '', 'down', 'Fixing the bug'),
  c_think: T('chin', '', 'svg:laptop', '', 'think', '', 'up', 'Thinking about the code'),
  c_save: T('hug', '', '💾', '✅', '', '', 'happy', 'Saving the file'),
  c_done: T('cheer', '', '', '🚀✨', 'sparkle', '', 'happy', 'The code is ready!'),
  c_button: T('tap', '🖱️', 'svg:laptop', '🔘', '', '', 'down', 'Adding buttons'),
  c_score: T('type', '', 'svg:laptop', '🏆💯', 'code', '', 'down', 'Adding a score counter'),
  c_anim: T('juggle', '', '✨', '💫', '', '', 'up', 'Making things move'),
  c_color: T('stroke', '🎨', 'svg:laptop', '🌈', '', '', 'smile', 'Choosing colours'),
  c_text: T('write', '✏️', '📄', '', '', '', 'down', 'Writing the words'),
  c_mobile: T('tap', '', '📱', '👆', '', '', 'down', 'Making it work on phones'),
  c_keys: T('type', '', 'svg:laptop', '⌨️', 'code', '', 'down', 'Adding keyboard controls'),

  // ---------- music ----------
  m_compose: T('write', '✏️', '🎼', '', 'notes', 'band', 'down', 'Writing the notes'),
  m_drums: T('drum', '', '🥁', '💥', '', 'band', 'smile', 'Making the drum beat'),
  m_melody: T('tap', '', '🎹', '', 'notes', 'band', 'smile', 'Playing the melody'),
  m_bass: T('strum', '', '🎸', '', 'notes', 'band', 'smile', 'Choosing the sound'),
  m_scratch: T('scratch', '', '', '', 'notes', 'band', 'smile', 'Scratching the record'),
  m_mix: T('type', '', 'svg:deck', '', 'notes', 'band', 'down', 'Mixing the beat'),
  m_listen: T('listen', '', '', '', 'notes', 'band', 'happy', 'Listening to the mix'),
  m_dance: T('dance', '', '', '', 'notes', 'band', 'happy', 'Dancing to the beat'),
  m_sing: T('point', '🎤', '', '', 'notes', '', 'smile', 'Singing along'),
  m_bpm: T('tap', '', '⏱️', '', 'notes', 'band', 'down', 'Setting the speed'),

  // ---------- thinking (chat) ----------
  t_think: T('chin', '', '', '', 'think', '', 'up', 'Thinking'),
  t_math: T('tap', '', '🧮', '➕➗', '', 'grad', 'down', 'Calculating'),
  t_read: T('read', '', '📖', '', '', '', '', 'Remembering what I know'),
  t_write: T('write', '✏️', '📄', '', '', '', 'down', 'Writing it down'),
  t_check: T('scan', 'svg:magnifier', '', '✅', '', '', 'side', 'Double-checking'),
  t_science: T('shake', '🧪', '', '🫧🫧', '', '', 'wide', 'Doing a science check'),
  t_space: T('peek', '🔭', '', '⭐🪐', '', '', 'up', 'Looking at the stars'),
  t_weather: T('spin', '☂️', '', '🌧️☀️', '', '', 'up', 'Checking the weather'),
  t_animal: T('hug', '', '🐶', '🐾', '', '', 'happy', 'Thinking about animals'),
  t_food: T('stir', '🥄', '🍲', '♨️', '', 'chef', 'down', 'Cooking up an answer'),
  t_music: T('listen', '', '', '', 'notes', 'band', 'happy', 'Humming a tune'),
  t_game: T('tap', '', '🎮', '👾', '', '', 'down', 'Thinking like a gamer'),
  t_art: T('stroke', '🖌️', '', '🎨', 'paint', '', 'smile', 'Picturing it'),
  t_lang: T('spin', '🌏', '', '💬', '', '', 'up', 'Translating'),
  t_history: T('read', '', '📜', '', '', '', '', 'Looking back in history'),
  t_idea: T('chin', '', '', '', 'idea', '', 'up', 'Getting an idea'),
  t_map: T('read', '', '🗺️', '📍', '', '', '', 'Finding the place'),
  t_time: T('spin', '⏰', '', '', '', '', 'up', 'Checking the time'),
  t_money: T('juggle', '', '🪙', '💰', '', '', 'up', 'Counting the money'),
  t_sport: T('juggle', '', '⚽', '', '', '', 'up', 'Thinking about sports'),
  t_photo: T('peek', '📷', '', '✨', '', '', 'up', 'Looking at your picture'),
  t_short: T('saw', '✂️', '', '✂️', '', '', 'down', 'Making it short'),
  t_explain: T('point', '', '', '', '', '', 'smile', 'Explaining'),
  t_story: T('read', '', '📖', '✨', '', 'wiz', '', 'Making up a story'),
  t_magic: T('conduct', '🪄', '', '✨🌟', 'sparkle', 'wiz', 'happy', 'Working some magic'),
  t_computer: T('type', '', 'svg:laptop', '', 'code', '', 'down', 'Thinking about computers'),
  t_health: T('hug', '', '🍎', '❤️', '', '', 'happy', 'Thinking about staying healthy'),
  t_nature: T('pour', '🚿', '', '🌱🌳', '', '', 'happy', 'Thinking about nature'),
  t_car: T('turn', '🔧', '', '🚗', '', '', 'down', 'Thinking about cars'),
  t_robot: T('spin', '🤖', '', '⚙️', 'gear', '', 'happy', 'Thinking about robots'),
  t_school: T('read', '', '📚', '✏️', '', 'grad', '', 'Thinking like a teacher'),
  t_hello: T('flag', '', '', '👋', '', '', 'happy', 'Saying hello'),
  t_joke: T('cheer', '', '', '😂', '', '', 'happy', 'Thinking of something funny'),
  t_feel: T('hug', '', '💖', '', '', '', 'happy', 'Thinking about how you feel'),
  t_ocean: T('pour', '🪣', '', '🌊🐟', '', '', 'happy', 'Diving into the ocean'),
  t_dino: T('dig', '⛏️', '', '🦖🦴', '', '', 'down', 'Digging up dinosaurs'),
  t_body: T('read', '', '🫀', '', '', '', '', 'Thinking about the body'),
  t_plan: T('write', '✏️', '📋', '', '', '', 'down', 'Making a plan'),

  // ---------- team ----------
  team_plan: T('write', '✏️', '📋', '👥', '', '', 'down', 'Splitting the job'),
  team_lead: T('conduct', '🪄', '', '👥✨', '', '', 'smile', 'Leading the team'),
  team_check: T('scan', 'svg:magnifier', '', '🧐', '', '', 'side', "Checking the team's work"),
  team_final: T('write', '✏️', '📜', '✨', '', '', 'down', 'Putting it all together'),

  // ---------- phone helpers ----------
  p_camera: T('peek', '📷', '', '✨', '', '', 'up', 'Opening the camera'),
  p_mic: T('listen', '', '', '🎤', '', '', 'wide', 'Listening'),
  p_location: T('read', '', '🗺️', '📍', '', '', '', 'Finding where we are'),
  p_vibrate: T('shake', '📳', '', '〰️', 'shakebot', '', 'wide', 'Buzzing your phone'),
  p_notify: T('shake', '🔔', '', '🔔', '', '', 'happy', 'Ringing the bell'),
  p_flashlight: T('point', '🔦', '', '✨', '', '', 'smile', 'Turning on the light'),
  p_clipboard: T('hug', '', '📋', '✅', '', '', 'happy', 'Copying the message'),
  p_speaker: T('point', '📢', '', '🔊', 'talk', '', 'smile', 'Speaking out loud'),
  p_wakelock: T('hold', '', '☕', '🌞', '', '', 'wide', 'Keeping the screen awake'),
  p_share: T('point', '📤', '', '✨', '', '', 'smile', 'Sharing'),
  p_motion: T('spin', '🧭', '', '🔄', '', '', 'up', 'Feeling the tilt'),
  p_fullscreen: T('measure', '', '', '⛶', 'tape', '', 'wide', 'Going full screen'),
};

/* ---------- picking the right activity ---------- */
const has = (s, re) => re.test(s);

// 3D: what the next part is decides the job.
export function actForPart(d, i = 0) {
  const n = String(d.n || '').toLowerCase(), s = d.s, m = d.m;
  const byName = [
    [/wheel|tire|tyre|ล้อ/, 'b_wheel'], [/engine|motor|เครื่องยนต์/, 'b_engine'], [/window|windshield|กระจก/, 'b_window'],
    [/flame|fire|exhaust|thruster|เปลว/, 'b_flame'], [/light|lamp|led|bulb|headlight|โคม/, 'b_light'],
    [/wing|fin|blade|ใบพัด|ปีก|ครีบ/, 'b_wing'], [/leaf|leaves|tree|plant|grass|flower|bush|ใบไม้|ต้น|ดอก|หญ้า/, 'b_plant'],
    [/door|gate|ประตู/, 'b_door'], [/roof|หลังคา/, 'b_roof'], [/eye|pupil|ตา/, 'b_eye'], [/flag|ธง/, 'b_flag'],
    [/screen|display|monitor|tv|จอ/, 'b_screen'], [/cable|wire|rope|hose|string|สาย|เชือก/, 'b_cable'],
    [/water|pool|sea|lake|river|wave|น้ำ|ทะเล/, 'b_water'], [/seat|chair|bench|sofa|เก้าอี้|ที่นั่ง/, 'b_seat'],
    [/antenna|aerial|เสาอากาศ/, 'b_antenna'], [/snow|ice|frost|หิมะ|น้ำแข็ง/, 'b_snow'], [/star|sparkle|ดาว/, 'b_star'],
    [/floor|ground|base|road|platform|pad|พื้น|ถนน|ฐาน/, 'b_tile'], [/wood|log|plank|trunk|ไม้/, 'b_wood'],
    [/bolt|screw|rivet|nut|น็อต/, 'b_drill'], [/gem|crystal|diamond|jewel|เพชร|คริสตัล/, 'b_gem'], [/rock|stone|หิน/, 'b_chisel'],
  ];
  for (const [re, id] of byName) if (has(n, re)) return id;
  if (m === 'glass') return 'b_polish';
  if (m === 'glow') return 'b_glow';
  if (m === 'metal') return i % 2 ? 'b_wrench' : 'b_weld';
  if (m === 'rubber') return 'b_rubber';
  const byShape = {
    gem: 'b_gem', rock: 'b_chisel', lathe: 'b_pottery', extrude: 'b_saw', tube: 'b_bend', plane: 'b_tile',
    torus: 'b_magnet', ring: 'b_magnet', sphere: 'b_round', hemisphere: 'b_round', cone: 'b_point', pyramid: 'b_point',
    wedge: 'b_glue', cylinder: 'b_drill', capsule: 'b_drill',
  };
  if (byShape[s]) return byShape[s];
  return ['b_hammer', 'b_paint', 'b_block'][i % 3]; // boxes: hammer, paint, stack — in turn
}

// Code: what is being typed right now decides the job.
export function actForCode(code, status = '') {
  const st = status.toLowerCase();
  if (/test/.test(st)) return 'c_test';
  if (/bug|fix|error/.test(st)) return 'c_fix';
  const tail = code.slice(-400), lower = code.toLowerCase();
  const inStyle = lower.lastIndexOf('<style') > lower.lastIndexOf('</style>');
  const inScript = lower.lastIndexOf('<script') > lower.lastIndexOf('</script>');
  if (inStyle) return /#[0-9a-f]{3,6}|rgb|hsl|gradient/i.test(tail) ? 'c_color' : 'c_css';
  if (inScript) {
    if (/AudioContext|oscillator|new Audio|\.play\(/.test(tail)) return 'c_sound';
    if (/keydown|keyup|ArrowLeft|ArrowRight|\.key\b/.test(tail)) return 'c_keys';
    if (/touch|pointer/.test(tail)) return 'c_mobile';
    if (/score|points|lives/i.test(tail)) return 'c_score';
    if (/requestAnimationFrame|setInterval|velocity|speed/.test(tail)) return 'c_game';
    if (/getContext|fillRect|arc\(|drawImage|ctx\./.test(tail)) return 'c_canvas';
    if (/animation|transform|rotate/.test(tail)) return 'c_anim';
    return 'c_js';
  }
  if (/<button/i.test(tail)) return 'c_button';
  if (/<canvas/i.test(tail)) return 'c_canvas';
  if (/<(h1|h2|p|li)\b/i.test(tail)) return 'c_text';
  if (code.length < 80) return 'c_plan';
  return 'c_html';
}

// Music: which part of the song is being written.
export function actForBeat(text) {
  const keys = [['"title"', 'm_compose'], ['"bpm"', 'm_bpm'], ['"instrument"', 'm_bass'], ['"kick"', 'm_drums'], ['"snare"', 'm_drums'], ['"hat"', 'm_drums'], ['"clap"', 'm_drums'], ['"melody"', 'm_melody']];
  let best = 'm_compose', at = -1;
  for (const [k, id] of keys) { const p = text.lastIndexOf(k); if (p > at) { at = p; best = id; } }
  return best;
}

// Chat: the words in Shobot's thought decide the job.
const THOUGHTS = [
  [/\bmath|\bcalculat|\badd|\bsubtract|\bmultipl|\bdivid|\bequation|\bnumber|\bsum|\bpercent|\bfraction|คำนวณ|บวก|ลบ|คูณ|หาร|เลข|สมการ|เศษส่วน/, 't_math'],
  [/\btranslat|\blanguage|\benglish|\bthai|\bword mean|แปล|ภาษา|ความหมาย/, 't_lang'],
  [/\bscience|\bchemi|\bexperiment|\batom|\bphysic|\blight|\bscatter|วิทยาศาสตร์|ทดลอง|เคมี|แสง/, 't_science'],
  [/\bspace|\bplanet|\bstar|\bmoon|\bsun|\bgalaxy|\brocket|\bastronaut|อวกาศ|ดาว|ดวงจันทร์|ดวงอาทิตย์|จรวด/, 't_space'],
  [/\bweather|\brain|\bcloud|\bstorm|\btemperature|อากาศ|ฝน|เมฆ|พายุ/, 't_weather'],
  [/\bdinosaur|\bfossil|ไดโนเสาร์/, 't_dino'],
  [/\bocean|\bsea|\bfish|\bwhale|\bshark|มหาสมุทร|ทะเล|ปลา/, 't_ocean'],
  [/\banimal|\bdog|\bcat|\bbird|\bpet|\blion|\btiger|สัตว์|หมา|แมว|นก/, 't_animal'],
  [/\bfood|\bcook|\brecipe|\beat|\bcake|\bpizza|อาหาร|ทำกับข้าว|สูตร|ขนม/, 't_food'],
  [/\bmusic|\bsong|\bsing|\bmelody|\bbeat|เพลง|ดนตรี|ร้อง/, 't_music'],
  [/\bgame|\broblox|\bminecraft|\bplay|\blevel|เกม/, 't_game'],
  [/\bdraw|\bart|\bcolou?r|\bpaint|\bpicture it|\bimagine|วาด|ศิลปะ|สี/, 't_art'],
  [/\bhistory|\bancient|\bking|\bwar|\bpast|ประวัติ|โบราณ|อดีต/, 't_history'],
  [/\bmap|\bwhere|\bcountry|\bcity|\bplace|ที่ไหน|ประเทศ|เมือง|แผนที่/, 't_map'],
  [/\btime|\bdate|\bclock|\bday|\bcalendar|เวลา|วันที่|นาฬิกา/, 't_time'],
  [/\bmoney|\bprice|\bcost|\bbaht|\bdollar|\bbuy|เงิน|ราคา|บาท/, 't_money'],
  [/\bsport|\bfootball|\bsoccer|\brun|\bexercise|กีฬา|ฟุตบอล|วิ่ง/, 't_sport'],
  [/\bphoto|\bpicture|\bimage|\blook at|รูป|ภาพ/, 't_photo'],
  [/\bstory|\btale|\bonce upon|นิทาน|เรื่องเล่า/, 't_story'],
  [/\bmagic|\bwizard|\bspell|เวทมนตร์|พ่อมด/, 't_magic'],
  [/\bcode|\bprogram|\bcomputer|\bapp|\bwebsite|\bhtml|โค้ด|คอม|เว็บ|แอป/, 't_computer'],
  [/\bhealth|\bbody|\bsick|\bdoctor|\beat well|สุขภาพ|หมอ|ป่วย/, 't_health'],
  [/\bheart|\bbrain|\bbone|\bmuscle|หัวใจ|สมอง|กระดูก/, 't_body'],
  [/\bplant|\btree|\bnature|\bforest|\bflower|ต้นไม้|ธรรมชาติ|ป่า|ดอกไม้/, 't_nature'],
  [/\bcar|\btruck|\bbike|\bvehicle|รถ/, 't_car'],
  [/\brobot|\bai\b|หุ่นยนต์/, 't_robot'],
  [/\bschool|\bhomework|\blesson|\bteach|\blearn|\bexam|โรงเรียน|การบ้าน|เรียน|สอบ/, 't_school'],
  [/\bhello|\bhi\b|\bgreet|สวัสดี|ทักทาย/, 't_hello'],
  [/\bjoke|\bfunny|\blaugh|ตลก|ขำ/, 't_joke'],
  [/\bfeel|\bsad|\bhappy|\bworried|\bfriend|ความรู้สึก|เศร้า|เพื่อน/, 't_feel'],
  [/\bplan|\bsteps|\borgani[sz]e|วางแผน|ขั้นตอน/, 't_plan'],
  [/\bcheck|\bverify|\bsure|\bcorrect|\bdouble|ตรวจ|เช็ก|ถูกต้อง/, 't_check'],
  [/\bshort|\bsimple|\bbrief|\bsummar|สั้น|ง่าย|สรุป/, 't_short'],
  [/\bwrite|\bwrit|\blist|จด|เขียน/, 't_write'],
  [/\bidea|\bcreative|\binvent|ไอเดีย|คิดค้น/, 't_idea'],
  [/\bremember|\brecall|\bknow|\bread|\blearn about|นึก|จำ|รู้|อ่าน/, 't_read'],
];
export function actForThought(text) {
  const t = String(text).toLowerCase();
  for (const [re, id] of THOUGHTS) if (re.test(t)) return id;
  return 't_think';
}

export const ABILITY_ACT = id => (ACTS['p_' + id] ? 'p_' + id : null);
