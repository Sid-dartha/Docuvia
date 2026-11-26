import { useState } from 'react'

function Flashcard({ card, index }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      type="button"
      className={`flashcard ${flipped ? 'is-flipped' : ''}`}
      onClick={() => setFlipped((value) => !value)}
      aria-pressed={flipped}
    >
      <span className="flashcard-tag">{flipped ? 'Answer' : `Card ${index + 1}`}</span>
      <span className="flashcard-text">{flipped ? card.answer : card.question}</span>
      <span className="flashcard-hint">{flipped ? 'Click to see the question' : 'Click to reveal'}</span>
    </button>
  )
}

function QuizQuestion({ item, index, picked, onPick }) {
  const answered = picked !== undefined
  return (
    <li className="quiz-question">
      <p className="quiz-prompt">
        <span className="quiz-number">Q{index + 1}</span>
        {item.question}
      </p>
      <div className="quiz-options">
        {item.options.map((option, optionIndex) => {
          let state = ''
          if (answered && optionIndex === item.answer) state = 'is-correct'
          else if (answered && optionIndex === picked) state = 'is-wrong'
          return (
            <button
              type="button"
              key={optionIndex}
              className={`quiz-option ${state}`}
              disabled={answered}
              onClick={() => onPick(optionIndex)}
            >
              <span className="quiz-letter">{String.fromCharCode(65 + optionIndex)}</span>
              {option}
            </button>
          )
        })}
      </div>
      {answered && (
        <p className={`quiz-feedback ${picked === item.answer ? 'is-correct' : 'is-wrong'}`}>
          {picked === item.answer ? 'Correct!' : `Not quite. The answer is ${String.fromCharCode(65 + item.answer)}.`}
          {item.explanation && <span> {item.explanation}</span>}
        </p>
      )}
    </li>
  )
}

export default function StudyPack({ pack }) {
  const [answers, setAnswers] = useState({})
  const answeredCount = Object.keys(answers).length
  const score = pack.quiz.filter((item, index) => answers[index] === item.answer).length

  return (
    <div className="study-pack">
      {pack.key_ideas.length > 0 && (
        <section className="study-section">
          <h3>Key ideas</h3>
          <ol className="key-ideas">
            {pack.key_ideas.map((idea, index) => <li key={index}>{idea}</li>)}
          </ol>
        </section>
      )}

      {pack.flashcards.length > 0 && (
        <section className="study-section">
          <h3>Flashcards</h3>
          <div className="flashcard-grid">
            {pack.flashcards.map((card, index) => (
              <Flashcard card={card} index={index} key={index} />
            ))}
          </div>
        </section>
      )}

      {pack.quiz.length > 0 && (
        <section className="study-section">
          <div className="quiz-heading">
            <h3>Check yourself</h3>
            <span className="quiz-score">
              {answeredCount === pack.quiz.length
                ? `Score: ${score} / ${pack.quiz.length}`
                : `${answeredCount} of ${pack.quiz.length} answered`}
            </span>
          </div>
          <ol className="quiz-list">
            {pack.quiz.map((item, index) => (
              <QuizQuestion
                key={index}
                item={item}
                index={index}
                picked={answers[index]}
                onPick={(choice) => setAnswers((prev) => ({ ...prev, [index]: choice }))}
              />
            ))}
          </ol>
          {answeredCount > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setAnswers({})}>
              Retry quiz
            </button>
          )}
        </section>
      )}
    </div>
  )
}
