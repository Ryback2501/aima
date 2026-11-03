// The new movement form in the open goal card (see index.html). It fills the Source and
// Category lists, starts the date at today, keeps the concept on one line, and switches the
// sign of the amount. view.js shows and hides it.

// A concept has at most this many characters.
export const CONCEPT_LIMIT = 50;

// A concept is always one line: line breaks become spaces, and only the first 50 characters stay.
export const oneLine = (text) => text.replace(/\r\n|\r|\n/g, ' ').slice(0, CONCEPT_LIMIT);

// An amount has at most this many numbers: up to 999,999.99.
export const AMOUNT_DIGITS = 8;

// Adds the numbers of a typed or pasted text at the end of the amount's numbers, as if they were
// typed one by one. Everything else is ignored. A 0 with no number before it is ignored too, and
// only the first numbers that fit are kept.
export function addDigits(digits, text) {
  let result = digits;
  for (const digit of text.replace(/\D/g, '')) {
    if (result.length === AMOUNT_DIGITS) break;
    if (result === '' && digit === '0') continue;
    result += digit;
  }
  return result;
}

// Deleting always removes the last number of the amount.
export const removeDigit = (digits) => digits.slice(0, -1);

// Today in the phone's own time, the way a date field writes it: "2026-10-31".
function today() {
  const now = new Date();
  const two = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

// formatAmount writes an amount in cents in the app's language (see createAmountFormatter).
export function createForm(form, { formatAmount }) {
  const document = form.ownerDocument;
  const field = (name) => form.elements.namedItem(name);
  const source = field('source');
  const category = field('category');
  const date = field('date');
  const concept = field('concept');
  const amount = field('amount');
  const sign = form.querySelector('.sign-switch');
  const message = form.querySelector('.form-message');
  const saveMessage = form.querySelector('.save-message');
  const buttons = [...form.querySelectorAll('.form-buttons button')];
  // The required fields. An empty one is marked when Save is tapped (see showMissing).
  const required = { source, date, category, amount };

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

  // The amount works like the card machines in shops: it takes only numbers, and the last two
  // are the cents. The form keeps the numbers itself and stops every change the browser would
  // make to the field, so the cursor always stays at the end, and only the whole amount can be
  // selected. With the whole amount selected, deleting empties it and typing replaces it.
  let digits = '';
  const end = () => amount.value.length;
  const allSelected = () =>
    end() > 0 && amount.selectionStart === 0 && amount.selectionEnd === end();

  function showAmount() {
    amount.value = digits ? formatAmount(Number(digits)) : '';
    amount.setSelectionRange(end(), end());
  }

  // A text with no numbers changes nothing, also when the whole amount is selected.
  function addText(text) {
    if (!/\d/.test(text)) return;
    digits = addDigits(allSelected() ? '' : digits, text);
    showAmount();
  }

  amount.addEventListener('beforeinput', (event) => {
    // A change that cannot be stopped is made by the browser itself (see below).
    if (!event.cancelable) return;
    // Undo and redo do nothing either: delete is the way back.
    event.preventDefault();
    if (event.inputType.startsWith('insert')) {
      addText(event.data ?? event.dataTransfer?.getData('text/plain') ?? '');
    } else if (event.inputType.startsWith('delete')) {
      digits = allSelected() ? '' : removeDigit(digits);
      showAmount();
    }
  });
  amount.addEventListener('paste', (event) => {
    event.preventDefault();
    addText(event.clipboardData?.getData('text/plain') ?? '');
  });
  // Some phone keyboards change the field in a way that cannot be stopped, and some build the
  // text while the person types. Then the amount is read again from the numbers in the field,
  // once the keyboard has finished: writing to the field before that would disturb it.
  function readAmount() {
    digits = addDigits('', amount.value);
    showAmount();
  }
  amount.addEventListener('input', (event) => {
    if (!event.isComposing) readAmount();
  });
  amount.addEventListener('compositionend', readAmount);

  // The cursor goes back to the end, and a selection of a part grows to the whole amount.
  function keepCursor() {
    if (document.activeElement !== amount) return;
    const { selectionStart: start, selectionEnd: stop } = amount;
    if (start === stop && start !== end()) amount.setSelectionRange(end(), end());
    if (start !== stop && (start !== 0 || stop !== end())) amount.setSelectionRange(0, end());
  }
  document.addEventListener('selectionchange', keepCursor);
  for (const type of ['select', 'click', 'keyup', 'mouseup', 'focus']) {
    amount.addEventListener(type, keepCursor);
  }

  // Starts the form again, empty: the lists from the sheet (or a message when they could not
  // be read), the date at today, and the amount below 0.
  function reset({ sources, categories, failed = false }) {
    fillList(source, sources);
    fillList(category, categories);
    message.hidden = !failed;
    showMissing([]);
    saveMessage.hidden = true;
    setSaving(false);
    date.value = today();
    concept.value = '';
    digits = '';
    amount.value = '';
    amount.placeholder = formatAmount(0);
    setSign('minus');
  }

  // What was typed, for Save: the amount as its typed numbers, and the sign.
  const values = () => ({
    source: source.value,
    date: date.value,
    category: category.value,
    concept: concept.value,
    digits,
    sign: sign.dataset.sign,
  });

  // Marks the given empty fields, and only them: the name turns red with " - Required" after
  // it, and the box gets a red border (see styles.css). The marks change only when Save is
  // tapped, and go away when the form opens again.
  function showMissing(names) {
    for (const [name, input] of Object.entries(required)) {
      const part = input.closest('.form-field');
      part.classList.toggle('missing', names.includes(name));
      part.querySelector('.field-message').hidden = !names.includes(name);
    }
  }

  // While a movement is being saved, Save and Cancel cannot be tapped.
  function setSaving(saving) {
    for (const button of buttons) button.disabled = saving;
    if (saving) saveMessage.hidden = true;
  }

  // The movement was not saved: the form stays as it is, and says so.
  const saveFailed = () => (saveMessage.hidden = false);

  return { reset, fitConcept, values, showMissing, setSaving, saveFailed };
}
