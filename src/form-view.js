// The new movement form in the open goal card (see index.html). It fills the Source and
// Category lists, starts the date at today, keeps the concept on one line, and switches the
// sign of the amount. view.js shows and hides it.

// A concept has at most this many characters.
export const CONCEPT_LIMIT = 50;

// A concept is always one line: line breaks become spaces, and only the first 50 characters stay.
export const oneLine = (text) => text.replace(/\r\n|\r|\n/g, ' ').slice(0, CONCEPT_LIMIT);

// Today in the phone's own time, the way a date field writes it: "2026-10-31".
function today() {
  const now = new Date();
  const two = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

export function createForm(form) {
  const document = form.ownerDocument;
  const field = (name) => form.elements.namedItem(name);
  const source = field('source');
  const category = field('category');
  const date = field('date');
  const concept = field('concept');
  const amount = field('amount');
  const sign = form.querySelector('.sign-switch');
  const message = form.querySelector('.form-message');

  concept.maxLength = CONCEPT_LIMIT;
  // The form never sends itself: that would load the page again.
  form.addEventListener('submit', (event) => event.preventDefault());

  // Fills a list to pick from: an empty choice first, so nothing is picked at the start, then
  // the options of the sheet's dropdown, in their order.
  function fillList(select, options = []) {
    select.replaceChildren(
      ...['', ...options].map((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        return option;
      }),
    );
  }

  // The concept field grows taller when its text wraps, and shorter again when it gets shorter.
  function fitConcept() {
    concept.style.height = 'auto';
    const css = document.defaultView.getComputedStyle(concept);
    const borders = parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
    concept.style.height = `${concept.scrollHeight + borders}px`;
  }

  // Enter adds no new line.
  concept.addEventListener('beforeinput', (event) => {
    if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
      event.preventDefault();
    }
  });
  // A pasted text with line breaks, or longer than 50 characters, is made to fit.
  concept.addEventListener('input', () => {
    const clean = oneLine(concept.value);
    if (clean !== concept.value) concept.value = clean;
    fitConcept();
  });

  function setSign(name) {
    sign.dataset.sign = name;
    for (const half of sign.querySelectorAll('[data-half]')) {
      half.classList.toggle('chosen', half.dataset.half === name);
    }
  }
  sign.addEventListener('click', () => setSign(sign.dataset.sign === 'minus' ? 'plus' : 'minus'));

  // Starts the form again, empty: the lists from the sheet (or a message when they could not
  // be read), the date at today, and the amount below 0.
  function reset({ sources, categories, failed = false }) {
    fillList(source, sources);
    fillList(category, categories);
    message.hidden = !failed;
    date.value = today();
    concept.value = '';
    amount.value = '';
    setSign('minus');
  }

  return { reset, fitConcept };
}
