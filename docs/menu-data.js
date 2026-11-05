const categories = [
  ['food', '푸드', 'Food'],
  ['bottle', '병 와인', 'Bottle Wine', '주문하신 음식과 손님 취향에 맞춰 소믈리에가 페어링을 제안합니다. 병 와인은 추천으로 주문하실 수 있습니다.'],
  ['glass', '글라스 와인', 'Glass Wine', '글라스 와인은 매일 바뀝니다. 오늘의 글라스 와인은 직원에게 문의해 주세요.'],
  ['highball', '하이볼', 'Highball'],
  ['cocktail', '칵테일', 'Cocktail']
];
const seed = [
  [
    ['순살닭튀김','Crispy Chicken Thigh',19,'인도커리크림 · 대파 · 파프리카'],
    ['라구파스타','Ragu Pasta',26,'한우 1+ · 오리 · 한돈'],
    ['족발','Braised Pork Trotters',25,'족발 · 아시안치미추리 · 쿠스쿠스'],
    ['부산 아귀 스테이크','Busan Monkfish Steak',36,'아귀간 · 수제 XO소스 · 닭껍질'],
    ['한돈 스테이크','Pork Steak',32,'젖산발효마늘 · 열무 · 파프리카'],
    ['참피뇨네스','Champinones',17,'양송이버섯 · 이태리햄'],
    ['양 숄더랙','Lamb Shoulder Rack',35,'젖산발효부추 · 양뼈농축액'],
    ['돼지껍데기','Pork Skin',17,'유산발효크림 · 갈치속젓 · 발효사과'],
    ['부산갈미조개 세비체','Busan Ark Clam Ceviche',17,'명지갈미조개 · 적양파 · 감귤'],
    ['100겹 감자패스츄리','100-Layer Potato',16,'양송이 · 명이나물 · 감자'],
    ['토마토','Tomato',14,'젖산발효토마토 · 베이컨 칩 · 허브'],
    ['멜론샐러드','Melon Salad',16,'후숙멜론 · 견과류 · 허브'],
    ['계절과일&부라타치즈','Burrata Cheese Seasonal Fruits',17,'과일 · 부라타치즈 · 제철발효과일'],
    ['쌀누룩 아이스크림','Rice Koji Ice Cream',8,'누룩 쌀 · 아이스크림'],
    ['티라미 쑥','Mugwort Tiramisu',10,'쑥 · 사보이아르디'],
    ['그린올리브&피클','Green Olive Pickles Plate',12,'숙성사과 · 발효자두 · 올리브']
  ],
  [['A','','3~5만 원대'],['B','','5~7만 원대'],['C','','7~10만 원대'],['S','','10~15만 원대'],['SS','','20~30만 원대'],['SSS','','','K-PRO 와인']],
  [
    ['스파클링','Sparkling Wine','12,000원부터'],
    ['화이트','White Wine','10,000원부터'],
    ['레드','Red Wine','10,000원부터'],
    ['주정강화 와인','Fortified Wine','','포트 와인 · 셰리 와인']
  ],
  [
    ['디토 하이볼','Ditto Highball',10,'시나몬 스틱으로 훈연한 시그니처 하이볼'],
    ['얼그레이 하이볼','Earl Grey Highball',10,'홍차의 풍미가 진한 하이볼'],
    ['진저에일 하이볼','Ginger Ale Highball',10,'진저의 깔끔한 풍미'],
    ['미도리 하이볼','Midori Highball',10,'멜론 베이스 하이볼'],
    ['잭 다니엘스 하이볼','Jack Daniel’s Highball',13,'잭 다니엘의 고유한 맛을 살린 하이볼']
  ],
  [
    ['진토닉','Gin Tonic',10,'깔끔한 바디감과 허브 풍미'],
    ['카카오 피즈','Cacao Fizz',12,'초콜릿의 풍미와 레몬의 산미'],
    ['갓파더','Godfather',14,'스모키함과 오크의 풍미'],
    ['블랙 러시안','Black Russian',10,'커피의 달콤 쌉쌀한 풍미'],
    ['셜리 템플','Shirley Temple',10,'딸기 베이스 · 논알코올']
  ]
];
const won = new Intl.NumberFormat('ko-KR');
const initial = seed.flatMap((rows, group) => rows.map(([name, english, price, detail = ''], i) => ({
  id: categories[group][0] + '-' + i, category: categories[group][0], state:'public',
  live:{name, english, price:typeof price === 'number' ? won.format(price * 1000) + '원' : price, detail}
})));
const storageKey = 'ditto-menu-preview-v1';
let records = initial;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored)) records = stored;
} catch {}

const $ = id => document.getElementById(id);
function node(tag, content, className) {
  const el = document.createElement(tag);
  if (content) el.textContent = content;
  if (className) el.className = className;
  return el;
}
function item(entry) {
  const row = node('article', '', 'item');
  const head = node('div', '', 'item-head');
  head.append(node('h3', entry.name), node('span', entry.price, 'price'));
  row.append(head);
  if (entry.english) row.append(node('p', entry.english));
  if (entry.detail) row.append(node('p', entry.detail));
  return row;
}
