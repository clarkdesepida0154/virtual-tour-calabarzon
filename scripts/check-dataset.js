#!/usr/bin/env node
/**
 * Offline review of data/destinations-seed.json — no database needed.
 *
 *   npm run data:check
 *
 * Validates the file (structure, word counts, coordinates, photo licences,
 * quiz shape) and then checks the one rule a schema cannot: every quiz
 * question must be answerable from the destination's own text. For each
 * question it confirms that the quoted `evidence` sentence really appears in
 * the description / history / cultural significance, and that the correct
 * answer can be found in that text.
 */

const fs = require('node:fs');

const { IMAGES_DIR, loadDataset, imagePaths, wordCount } = require('./lib/dataset');

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function main() {
  const dataset = loadDataset(); // throws with a full list if the file is not valid
  const problems = [];
  const notes = [];
  const licences = new Map();
  let photosOnDisk = 0;

  console.log('Destination                                        hist  signif  photos');
  for (const destination of dataset.destinations) {
    const text = normalize(
      [destination.description, destination.history, destination.cultural_significance].join(' '),
    );

    destination.quiz.forEach((item, index) => {
      const label = `${destination.slug} Q${index + 1}`;
      if (!item.evidence || !text.includes(normalize(item.evidence))) {
        problems.push(`${label}: the evidence sentence is not in the destination's text`);
      }
      const correct = item.options.find((option) => option.correct).text;
      const needle = normalize(correct).replace(/^(the|a|an) /, '').replace(/\.$/, '');
      if (!text.includes(needle)) {
        notes.push(`${label}: answer "${correct}" is a paraphrase of the text — re-read it by hand`);
      }
    });

    for (const image of destination.images) {
      licences.set(image.license, (licences.get(image.license) || 0) + 1);
      if (fs.existsSync(imagePaths(destination, image).local)) photosOnDisk += 1;
    }

    console.log(
      `${destination.name.slice(0, 50).padEnd(50)} ${String(wordCount(destination.history)).padStart(4)} ` +
        `${String(wordCount(destination.cultural_significance)).padStart(7)}  ` +
        `${destination.images.map((image) => image.license).join(', ')}` +
        `${destination.image_review ? '  ⚑ review' : ''}`,
    );
  }

  const totalPhotos = dataset.destinations.reduce((sum, d) => sum + d.images.length, 0);
  const totalQuestions = dataset.destinations.reduce((sum, d) => sum + d.quiz.length, 0);
  console.log(
    `\n${dataset.destinations.length} destinations · ${totalQuestions} quiz questions · ${totalPhotos} photos ` +
      `(${photosOnDisk} processed in ${IMAGES_DIR.split(/[\\/]/).slice(-2).join('/')})`,
  );
  console.log(`Licences: ${[...licences].map(([name, count]) => `${name} ×${count}`).join(', ')}`);

  const flagged = dataset.destinations.filter((destination) => destination.image_review);
  if (flagged.length > 0) {
    console.log('\nPhotos flagged for a second look:');
    for (const destination of flagged) console.log(`  - ${destination.name}: ${destination.image_review}`);
  }
  if (notes.length > 0) console.log(`\nNotes:\n  - ${notes.join('\n  - ')}`);
  if (problems.length > 0) {
    console.error(`\nProblems:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log('\nDataset is valid and every quiz question is answerable from its own text.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
