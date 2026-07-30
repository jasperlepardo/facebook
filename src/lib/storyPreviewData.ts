import { DailySummary, Arc } from '@/types'

// ── Summaries ──────────────────────────────────────────────────────────────────

function day(
  date: string,
  messageCount: number,
  mood: string,
  summary: string,
  themes: string[],
  linkedDates: DailySummary['linkedDates'] = []
): DailySummary {
  const [y, m, d] = date.split('-').map(Number)
  return { date, year: y, month: m, day: d, messageCount, mood, summary, themes, linkedDates, generatedAt: '', model: 'preview' }
}

// ── 2016-07 : The Beginning ────────────────────────────────────────────────────

const jul2016: DailySummary[] = [
  day('2016-07-14', 3, 'tentative, hopeful',
    'It began quietly — just three messages, short and careful, like the first page of something neither of them knew they were starting. Jasper reached out first. Ciara replied. There was nothing remarkable about the words themselves, but something had opened.',
    ['first message', 'beginning'],
    [{ date: '2016-07-18', type: 'resolved-on', label: 'first real conversation' }]),
  day('2016-07-15', 1, 'light, curious',
    'A single message from Ciara — unprompted. She had thought of him first.',
    ['small moments']),
  day('2016-07-16', 10, 'playful, easy',
    'Ten messages, and Jasper made her laugh at least once. That felt like progress.',
    ['humour', 'getting to know each other']),
  day('2016-07-17', 37, 'warm, engaged',
    'Something accelerated. Thirty-seven messages, and the hours between replies shortened. They talked about real things — not just surface things. At some point the conversation stopped feeling like small talk.',
    ['opening up', 'connection'],
    [{ date: '2016-07-14', type: 'continues-from', label: 'it started here' }]),
  day('2016-07-18', 198, 'excited, breathless',
    'One hundred and ninety-eight messages. Whatever this was, it was real now. They talked through the afternoon and into the night. By the time it went quiet, something had shifted. This was no longer two strangers being polite.',
    ['first long conversation', 'turning point'],
    [{ date: '2016-07-14', type: 'continues-from', label: 'the beginning' }]),
  day('2016-07-20', 89, 'light, happy',
    'The ease from two days ago hadn\'t faded — if anything, it settled deeper. The conversation moved quickly, the way it does when two people stop trying to impress each other.',
    ['comfort', 'natural rhythm']),
  day('2016-07-23', 142, 'warm, close',
    'A longer evening. They stayed up later than either of them probably meant to, the messages slowing not because the conversation ran out, but because they were both tired and didn\'t want to say it.',
    ['late nights', 'not wanting to stop']),
  day('2016-07-25', 67, 'playful, flirty',
    'Somewhere in the middle of it, the tone shifted — a little warmer, a little more pointed. Neither acknowledged it directly. Neither had to.',
    ['flirting', 'unspoken things']),
  day('2016-07-27', 201, 'tender, open',
    'Jasper told her something he hadn\'t planned to. She didn\'t make a thing of it. Just replied simply and moved the conversation forward. He noticed that.',
    ['vulnerability', 'trust building']),
  day('2016-07-29', 115, 'happy, light',
    'A good day. Nothing dramatic happened — they just talked, easily and for a long time. The kind of day that doesn\'t make headlines but that both of them would remember.',
    ['ordinary joy', 'ease']),
  day('2016-07-31', 88, 'warm, anticipating',
    'The last day of July. They\'d been talking for seventeen days now. Something about that number — so small, and already so loaded.',
    ['reflection', 'growing feelings']),
]

// ── 2016-08 : Honeymoon Phase ──────────────────────────────────────────────────

const aug2016: DailySummary[] = [
  day('2016-08-02', 156, 'happy, excited', 'They made plans today — something vague, something real. The first time they\'d talked about actually seeing each other.', ['making plans', 'anticipation']),
  day('2016-08-04', 203, 'playful, warm', 'A day that started with a joke and ended hours later. Everything between was easy.', ['banter', 'comfort']),
  day('2016-08-06', 88, 'sweet, close', 'Ciara sent him something she\'d been thinking about for a few days. He responded immediately.', ['spontaneous', 'connection']),
  day('2016-08-08', 312, 'happy, excited', 'They stayed up until 2 AM. It wasn\'t the first time. It was starting to feel like a habit neither wanted to break.', ['late nights', 'not wanting to stop']),
  day('2016-08-10', 134, 'warm, tender', 'A slower day. The conversation was shorter than usual, but what was there felt more deliberate.', ['depth', 'intention']),
  day('2016-08-12', 245, 'playful, light', 'Pure banter from start to finish. Ciara won most of it.', ['humour', 'playfulness']),
  day('2016-08-14', 167, 'happy, warm', 'Something Jasper said made her laugh so hard she screenshot it. He found out three days later.', ['laughter', 'small moments']),
  day('2016-08-16', 289, 'excited, hopeful', 'They talked about music. Then movies. Then the things they wanted to do eventually — loosely, without commitment, but still.', ['dreams', 'future talk']),
  day('2016-08-18', 198, 'warm, close', 'It was getting hard to remember what the days were like before this.', ['becoming a constant', 'dependence']),
  day('2016-08-20', 341, 'happy, light', 'One of the better days. Jasper was in a good mood; it was contagious.', ['good mood', 'shared energy']),
  day('2016-08-22', 155, 'tender, sweet', 'She asked about his family. He answered more honestly than he expected to.', ['vulnerability', 'getting deeper']),
  day('2016-08-24', 178, 'warm, comfortable', 'The comfort between them was obvious now. Less performing, more just being.', ['ease', 'authenticity']),
  day('2016-08-26', 220, 'playful, warm', 'A long Friday evening. Neither of them had anywhere to be.', ['weekend energy', 'leisure']),
  day('2016-08-28', 267, 'close, happy', 'They talked about what they were afraid of. It was the first time anything that heavy had come up.', ['fear', 'opening up']),
  day('2016-08-30', 189, 'tender, hopeful', 'August ending. The month had happened fast. In forty-five days they\'d gone from strangers to something harder to name.', ['reflection', 'progress']),
]

// ── 2016-10 : First Rough Patch ───────────────────────────────────────────────

const oct2016: DailySummary[] = [
  day('2016-10-02', 134, 'easy, warm', 'Still good. The roughness of September had faded.', ['recovery', 'warmth']),
  day('2016-10-05', 98, 'light, comfortable', 'A quiet Sunday. Not much was said, and that was fine.', ['comfortable silence', 'rest']),
  day('2016-10-08', 201, 'playful, happy', 'Back to form. Jasper was funny today. Ciara didn\'t let him know how funny.', ['humour', 'banter']),
  day('2016-10-10', 156, 'warm, close', 'A longer conversation in the afternoon. They hadn\'t done that in a while.', ['reconnecting', 'depth']),
  day('2016-10-12', 87, 'tense, uncertain',
    'Something was off. The messages were shorter, the replies slower. Neither of them named it.',
    ['tension', 'unspoken things'],
    [{ date: '2016-10-17', type: 'resolved-on', label: 'cleared the air' }]),
  day('2016-10-13', 45, 'distant, strained',
    'The worst kind of day — not a fight, just a wall. Ciara was there but felt far away. Jasper noticed but didn\'t push.',
    ['distance', 'emotional withdrawal'],
    [{ date: '2016-10-12', type: 'continues-from', label: 'tension started' }]),
  day('2016-10-14', 23, 'tense, difficult',
    'Very few messages. The silence said more than either of them meant to. By evening Jasper tried to reach back in. It didn\'t quite land.',
    ['difficult silence', 'trying']),
  day('2016-10-15', 112, 'tense → tentative',
    'More words today, but careful ones. They were both watching where they stepped. Progress, of a kind.',
    ['careful', 'rebuilding']),
  day('2016-10-16', 178, 'relieved, cautious',
    'They got closer to the thing. Jasper said something honest. Ciara admitted something she\'d been sitting on. The air shifted slightly.',
    ['honesty', 'breakthrough']),
  day('2016-10-17', 234, 'warm → resolved',
    'The wall came down today. Not dramatically — just gradually, through a long afternoon conversation that covered everything they\'d been avoiding. By the end of it they were themselves again.',
    ['resolution', 'relief', 'reconnection'],
    [{ date: '2016-10-12', type: 'continues-from', label: 'the rough week' }]),
  day('2016-10-19', 189, 'light, happy', 'The kind of day that only feels this good because of what came before it.', ['relief', 'appreciation']),
  day('2016-10-22', 145, 'warm, easy', 'Things felt lighter. They laughed about something they\'d both been taking too seriously.', ['perspective', 'lightness']),
  day('2016-10-25', 267, 'close, warm', 'A good long conversation. The kind that reminds you why you bothered working through the hard part.', ['connection', 'depth']),
  day('2016-10-28', 156, 'tender, content', 'October ending on a good note. Better than it started.', ['contentment', 'gratitude']),
]

// ── 2016-12 : First Christmas Together ────────────────────────────────────────

const dec2016: DailySummary[] = [
  day('2016-12-01', 198, 'warm, happy', 'December arrived and Jasper was in good spirits. Christmas had always been his favourite.', ['excitement', 'seasonal joy']),
  day('2016-12-05', 167, 'playful, light', 'They made a list of bad Christmas movies to watch. Neither of them would actually watch any of them.', ['plans', 'humour']),
  day('2016-12-10', 234, 'warm, romantic', 'A long evening conversation. Jasper told her he\'d been thinking about her more than he\'d let on.', ['confession', 'growing closer']),
  day('2016-12-14', 189, 'sweet, tender', 'Ciara mentioned something about Christmas that Jasper filed away without saying so.', ['thoughtfulness', 'attention']),
  day('2016-12-17', 145, 'light, fun', 'They argued about something completely inconsequential and both enjoyed it thoroughly.', ['banter', 'comfort']),
  day('2016-12-20', 278, 'warm, close', 'Five months. They didn\'t mark it officially — it wasn\'t official — but both of them knew.', ['milestone', 'reflection']),
  day('2016-12-23', 312, 'excited, happy', 'Christmas was two days away. Jasper was childlike about it. Ciara found this endearing.', ['excitement', 'personality']),
  day('2016-12-25', 89, 'warm, sweet', 'Christmas Day. Fewer messages than usual — both of them with family — but the ones that came through were warm.', ['holiday', 'thinking of each other']),
  day('2016-12-28', 201, 'content, reflective', 'The quiet week between Christmas and New Year. They talked about the year.', ['reflection', 'gratitude']),
  day('2016-12-31', 267, 'hopeful, warm', 'New Year\'s Eve. They stayed up past midnight — not together, but texting through it. The year turned with them both still there.', ['new year', 'hope', 'together apart']),
]

// ── 2017-02 : Valentine's Month ───────────────────────────────────────────────

const feb2017: DailySummary[] = [
  day('2017-02-01', 189, 'warm, happy', 'February. Jasper mentioned Valentine\'s Day without seeming to mean to. Ciara clocked it.', ['anticipation', 'subtle']),
  day('2017-02-03', 234, 'light, playful', 'A good Sunday. Nothing heavy — just two people who were happy to be talking to each other.', ['ease', 'contentment']),
  day('2017-02-06', 156, 'warm, close', 'Mid-week. They were finding a rhythm — even across the distance.', ['long distance', 'routine']),
  day('2017-02-08', 198, 'tender, sweet', 'Jasper sent something in the morning — just a small thing — that Ciara thought about for the rest of the day.', ['small gestures', 'affection']),
  day('2017-02-10', 312, 'excited, warm',
    'Four days out from Valentine\'s Day and they were both pretending they weren\'t thinking about it. The conversation had a particular kind of energy — bright and slightly electric.',
    ['anticipation', 'romance'],
    [{ date: '2017-02-14', type: 'resolved-on', label: 'Valentine\'s Day' }]),
  day('2017-02-12', 245, 'romantic, tender',
    'The weekend before Valentine\'s Day. Jasper said something he\'d been building to for a while. Ciara received it quietly, which was how she received things that mattered.',
    ['confession', 'tenderness', 'milestone']),
  day('2017-02-13', 289, 'warm, anticipating',
    'The day before. Neither of them talked about it directly, but the subtext was everywhere. Playful messages that meant more than they looked.',
    ['anticipation', 'unspoken']),
  day('2017-02-14', 401, 'romantic, warm, happy',
    'Valentine\'s Day. They\'d agreed not to make a big deal of it, which meant they both made a medium-sized deal of it. It was exactly right — not too much, not nothing. By the end of the night something felt more decided than it had the day before.',
    ['Valentine\'s Day', 'romance', 'milestone'],
    [{ date: '2017-02-10', type: 'continues-from', label: 'the lead-up' }]),
  day('2017-02-16', 178, 'content, happy', 'The day after always tells you more than the day itself. This one was warm.', ['aftermath', 'contentment']),
  day('2017-02-19', 156, 'warm, comfortable', 'A good week. They were in something real now — officially or not.', ['relationship', 'clarity']),
  day('2017-02-22', 189, 'light, playful', 'February winding down. The month had been good to them.', ['ease', 'lightness']),
  day('2017-02-25', 201, 'warm, close', 'A long Saturday conversation. Jasper was in a philosophical mood. Ciara humoured him.', ['depth', 'humour']),
  day('2017-02-27', 145, 'content, happy', 'February\'s last Monday. Another good one.', ['contentment']),
]

// ── 2017-08 : Summer ──────────────────────────────────────────────────────────

const aug2017: DailySummary[] = [
  day('2017-08-03', 189, 'light, easy', 'A slow August Thursday. They talked about nothing important and everything comfortable.', ['summer', 'ease']),
  day('2017-08-07', 234, 'happy, warm', 'Weekend. Jasper was somewhere sunny. Ciara could tell from the energy of his messages.', ['weekend', 'good mood']),
  day('2017-08-11', 156, 'playful, happy', 'A running joke that started today and would come back at least a dozen times in the next year.', ['inside jokes', 'levity']),
  day('2017-08-15', 201, 'warm, close', 'August midpoint. They\'d been doing this for over a year now. Neither of them made it strange.', ['anniversary', 'normalcy']),
  day('2017-08-19', 178, 'tender, warm', 'Ciara told him something she\'d been sitting on. He didn\'t make it a big moment. She was grateful for that.', ['trust', 'discretion']),
  day('2017-08-23', 145, 'light, comfortable', 'A good evening. Some days exist just to remind you everything is fine.', ['peace', 'gratitude']),
  day('2017-08-27', 267, 'warm, happy', 'August ending. Summer had been good. They both said something like that, in different words.', ['reflection', 'summer ending']),
]

// ── 2018-01 : New Year ────────────────────────────────────────────────────────

const jan2018: DailySummary[] = [
  day('2018-01-02', 178, 'hopeful, easy', 'The year began quietly. New Year\'s energy without the pressure.', ['new year', 'fresh start']),
  day('2018-01-06', 156, 'warm, comfortable', 'Back to the routine after the holidays. There was something comforting about that.', ['routine', 'comfort']),
  day('2018-01-10', 201, 'playful, happy', 'A midweek conversation that went long. Neither of them had planned for that.', ['spontaneous', 'connection']),
  day('2018-01-14', 189, 'warm, close', 'They talked about the year ahead. Loosely, without making promises. Just possibility.', ['future', 'hope']),
  day('2018-01-18', 234, 'light, happy', 'A good Thursday. Jasper was funny, Ciara was quick, and both of them knew it was good.', ['rhythm', 'ease']),
  day('2018-01-22', 145, 'comfortable, warm', 'A conversation that filled the afternoon without filling it with anything in particular.', ['ordinariness', 'contentment']),
  day('2018-01-27', 178, 'reflective, tender', 'January ending. The month felt stable. They felt stable.', ['stability', 'gratitude']),
]

// ── 2018-02 : Before the Storm ────────────────────────────────────────────────

const feb2018: DailySummary[] = [
  day('2018-02-02', 189, 'warm, easy', 'February again. Something about this month always felt significant.', ['February', 'anticipation']),
  day('2018-02-05', 156, 'light, playful', 'A good Monday. Valentine\'s Day still over a week away and neither of them was thinking about it yet.', ['ease', 'normalcy']),
  day('2018-02-08', 234, 'warm, romantic', 'Valentine\'s energy starting to build. Jasper had been planning something he hadn\'t told her yet.', ['anticipation', 'romance']),
  day('2018-02-12', 312, 'happy, tender', 'A good Valentine\'s weekend. Easier than last year\'s in some ways, more loaded in others.', ['Valentine\'s', 'milestone']),
  day('2018-02-14', 267, 'romantic, warm', 'Their second Valentine\'s Day. More confident this time. Less performance, more intention.', ['Valentine\'s', 'love', 'depth']),
  day('2018-02-18', 189, 'content, warm', 'The easy days after. Everything felt settled. Which, in hindsight, made what came next harder.', ['calm before storm', 'contentment']),
  day('2018-02-22', 145, 'slightly tense, uncertain', 'Something small happened today. Neither of them named it. But it registered.', ['unease', 'foreshadowing']),
  day('2018-02-26', 167, 'quiet, pensive', 'A quieter-than-usual Monday. Both of them processing something separately.', ['withdrawal', 'internal']),
]

// ── 2018-03 : The Storm ───────────────────────────────────────────────────────

const mar2018: DailySummary[] = [
  day('2018-03-01', 178, 'cautious, warm', 'March arrived and they started it gently — both of them aware of the February undercurrent without naming it.', ['careful', 'awareness']),
  day('2018-03-03', 156, 'comfortable, easy', 'A better day. The unease faded. Maybe it had been nothing.', ['relief', 'normalcy']),
  day('2018-03-05', 189, 'playful, light', 'Back to form. Jasper was funny, Ciara was sharp. The February tension seemed distant.', ['levity', 'reconnecting']),
  day('2018-03-07', 234, 'warm, close', 'A long evening conversation that covered real ground. They were good at this, when they weren\'t in the way of themselves.', ['depth', 'connection']),
  day('2018-03-08', 67, 'tense, strained',
    'It started with something small — a comment that landed wrong, a reply that came too late. By evening the temperature had dropped. Neither of them went to bed happy.',
    ['tension', 'misunderstanding', 'beginning'],
    [{ date: '2018-03-14', type: 'resolved-on', label: 'things cleared' }]),
  day('2018-03-09', 34, 'tense, difficult',
    'The day after is always the hardest to navigate. Jasper tried twice to open the conversation back up. Ciara wasn\'t ready.',
    ['withdrawal', 'difficult', 'trying'],
    [{ date: '2018-03-08', type: 'continues-from', label: 'it started yesterday' }]),
  day('2018-03-10', 23, 'distant, hurt',
    'Almost no messages. What there was felt formal — careful in the wrong way. Ciara sent one message in the morning that Jasper didn\'t quite know how to answer.',
    ['distance', 'hurt', 'silence']),
  day('2018-03-11', 89, 'tense → tentative',
    'More words today, but all of them walking on glass. By evening there was a longer exchange that didn\'t resolve anything but at least felt honest.',
    ['honesty', 'cautious progress']),
  day('2018-03-12', 145, 'difficult, searching',
    'They got closer to the actual thing today. Ciara said something that surprised them both with its directness. Jasper sat with it before responding.',
    ['breakthrough', 'honesty', 'vulnerability']),
  day('2018-03-13', 201, 'exhausted, turning',
    'A long day of back and forth. Not a fight exactly — more like two people dismantling something together while also trying to keep the pieces. By midnight they were still talking.',
    ['processing', 'endurance', 'working through it']),
  day('2018-03-14', 312, 'relieved, tender',
    'The wall came down today. Not all at once — gradually, over hours. Something Jasper said in the afternoon shifted the whole conversation. Ciara cried. He didn\'t know, but some part of him did. By evening they were talking the way they used to, and they both noticed it.',
    ['resolution', 'relief', 'love', 'repair'],
    [{ date: '2018-03-08', type: 'continues-from', label: 'a week in the storm' }]),
  day('2018-03-15', 234, 'warm, grateful',
    'The first easy day in a week. Everything felt lighter because they knew now what it felt like when it wasn\'t.',
    ['gratitude', 'relief', 'appreciation']),
  day('2018-03-16', 189, 'close, tender',
    'They talked about what had happened — calmly, with some distance on it. The kind of conversation that makes you stronger if you don\'t run from it.',
    ['post-fight clarity', 'honesty', 'growth']),
  day('2018-03-17', 267, 'warm, playful',
    'A deliberate lightness today — both of them choosing it. Jasper was funny in the morning and Ciara let herself enjoy it.',
    ['choosing lightness', 'recovery']),
  day('2018-03-18', 201, 'happy, easy',
    'Whatever had cracked had also let more light in. The conversation was easier than it had been in weeks.',
    ['openness', 'ease', 'growth']),
  day('2018-03-20', 178, 'warm, close',
    'A mid-week evening that stretched late. They were back.',
    ['reconnection', 'normal again']),
  day('2018-03-22', 156, 'content, warm',
    'Thursday. Ordinary. Good.',
    ['ordinariness', 'peace']),
  day('2018-03-24', 234, 'light, happy',
    'A weekend Saturday that felt earned. Jasper made a joke about something from the fight. Ciara laughed. That meant everything.',
    ['healing', 'humour as signal']),
  day('2018-03-26', 189, 'warm, reflective',
    'March winding down. The month had been a lot. But they\'d come out the other side of it more themselves, or maybe more each other\'s.',
    ['reflection', 'growth', 'strength']),
  day('2018-03-28', 145, 'comfortable, content',
    'A quiet Wednesday. The dust fully settled.',
    ['peace', 'stability']),
  day('2018-03-30', 201, 'warm, happy',
    'Almost April. The worst month in recent memory was ending as a good one.',
    ['closing out', 'gratitude']),
]

// ── Assemble by month ──────────────────────────────────────────────────────────

export const PREVIEW_BY_MONTH: Record<string, DailySummary[]> = {
  '2016-7':  jul2016,
  '2016-8':  aug2016,
  '2016-10': oct2016,
  '2016-12': dec2016,
  '2017-2':  feb2017,
  '2017-8':  aug2017,
  '2018-1':  jan2018,
  '2018-2':  feb2018,
  '2018-3':  mar2018,
}

export const PREVIEW_META = {
  years: [2016, 2017, 2018],
  byYear: {
    2016: [7, 8, 10, 12],
    2017: [2, 8],
    2018: [1, 2, 3],
  },
}

// ── Arcs ──────────────────────────────────────────────────────────────────────

export const PREVIEW_ARCS: Arc[] = [
  {
    title: 'The Beginning',
    startDate: '2016-07-14',
    endDate: '2016-07-18',
    description: 'Five days that started with three quiet messages and ended with nearly two hundred. The story began here — neither of them knowing yet what they were starting.',
    themes: ['first contact', 'accelerating connection', 'turning point'],
    mood: 'hopeful → breathless',
    dayCount: 5,
    generatedAt: '', model: 'preview',
  },
  {
    title: 'First Real Fight',
    startDate: '2016-10-12',
    endDate: '2016-10-17',
    description: 'Six days of distance, silence, and careful navigation before the air finally cleared. Their first real test, and they passed it — slowly, honestly.',
    themes: ['tension', 'distance', 'resolution', 'growth'],
    mood: 'tense → relieved',
    dayCount: 6,
    generatedAt: '', model: 'preview',
  },
  {
    title: "Valentine's Weekend",
    startDate: '2017-02-12',
    endDate: '2017-02-14',
    description: 'Their first Valentine\'s Day. They\'d agreed not to make a big deal of it, which meant they both made a medium-sized deal of it. It was exactly right.',
    themes: ['romance', 'milestone', 'intention'],
    mood: 'romantic, warm',
    dayCount: 3,
    generatedAt: '', model: 'preview',
  },
  {
    title: 'The Storm',
    startDate: '2018-03-08',
    endDate: '2018-03-14',
    description: 'Seven days that started with a comment that landed wrong and ended with something cracked open and better for it. The hardest week in the archive.',
    themes: ['fight', 'distance', 'hurt', 'repair'],
    mood: 'tense → broken → resolved',
    dayCount: 7,
    generatedAt: '', model: 'preview',
  },
  {
    title: 'Finding Each Other Again',
    startDate: '2018-03-15',
    endDate: '2018-03-24',
    description: 'Ten days of coming back — not to where they were, but somewhere better. The lightness was chosen now, not assumed.',
    themes: ['recovery', 'growth', 'gratitude', 'new normal'],
    mood: 'warm, grateful, easy',
    dayCount: 10,
    generatedAt: '', model: 'preview',
  },
]
