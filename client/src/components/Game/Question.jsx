export default function Question({ index, total, text }) {
  return (
    <div>
      <p className="font-semibold text-muted">Question {index + 1} of {total}</p>
      <h1 className="mt-2 text-2xl font-extrabold leading-snug sm:text-4xl">{text}</h1>
    </div>
  );
}
