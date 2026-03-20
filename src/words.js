const colors = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black',
  'white', 'grey', 'cyan', 'magenta', 'brown', 'indigo', 'violet', 'teal',
  'coral', 'crimson', 'amber', 'jade', 'navy', 'olive', 'maroon', 'azure',
  'beige', 'ivory', 'lavender', 'lime', 'gold', 'silver',
];

const moods = [
  'happy', 'angry', 'sleepy', 'grumpy', 'jolly', 'calm', 'wild', 'lazy',
  'brave', 'sneaky', 'silly', 'gloomy', 'peppy', 'moody', 'spooky', 'cozy',
  'fuzzy', 'bouncy', 'cranky', 'dreamy', 'funky', 'giddy', 'hangry', 'hyper',
  'jumpy', 'lively', 'nerdy', 'noisy', 'quirky', 'rowdy', 'sassy', 'snappy',
];

const produce = [
  'watermelon', 'mango', 'kiwi', 'lemon', 'lime', 'peach', 'plum', 'grape',
  'cherry', 'melon', 'papaya', 'guava', 'lychee', 'fig', 'coconut', 'apricot',
  'pumpkin', 'carrot', 'radish', 'turnip', 'beet', 'celery', 'broccoli',
  'spinach', 'cabbage', 'avocado', 'tomato', 'potato', 'onion', 'garlic',
  'ginger', 'parsley', 'pepper', 'zucchini', 'eggplant', 'artichoke',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAlias() {
  return `${pick(colors)}-${pick(moods)}-${pick(produce)}`;
}

function generateUsername() {
  return `${pick(colors)}-${pick(produce)}`;
}

module.exports = { generateAlias, generateUsername };
