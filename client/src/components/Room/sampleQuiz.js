// One-click demo quiz so you can test a game in seconds.
// (correctIndex is spread across 0-3 on purpose)
export const sampleQuiz = {
  title: 'General knowledge warm-up',
  questions: [
    { text: 'What is the capital city of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2, timeLimitSec: 15 },
    { text: 'How many bones are in an adult human body?', options: ['206', '212', '196', '248'], correctIndex: 0, timeLimitSec: 15 },
    { text: 'Which language has the most native speakers?', options: ['English', 'Hindi', 'Spanish', 'Mandarin Chinese'], correctIndex: 3, timeLimitSec: 15 },
    { text: 'What does HTTP stand for?', options: ['HyperText Transfer Protocol', 'High Transfer Text Process', 'HyperText Transmission Path', 'Host Transfer Type Protocol'], correctIndex: 0, timeLimitSec: 15 },
    { text: 'Which data structure follows First-In-First-Out order?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correctIndex: 1, timeLimitSec: 15 },
    { text: 'Which Redis data type keeps members ordered by score?', options: ['Hash', 'List', 'Set', 'Sorted Set'], correctIndex: 3, timeLimitSec: 15 },
    { text: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Botticelli'], correctIndex: 1, timeLimitSec: 15 },
    { text: 'What is the chemical symbol for gold?', options: ['Ag', 'Gd', 'Go', 'Au'], correctIndex: 3, timeLimitSec: 15 },
  ],
};
