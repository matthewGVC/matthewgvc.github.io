/* ============================================================
   PIECES — every piece the helper writes into a job's folder (spec Slice 5 S3, D95).

     PIECES[tool] = {
       prefix   the file name's first words ("Showsheet - <Address Unit> - <date>.pdf")
       words    how the piece is named in a sentence ("older brochure left in place: …")
       folder   the folder it goes in, looked for in Marketing\ first, then the job's top
                (exactly the folder names folder-health.js counts as that piece's folder, so
                a file the helper writes is always one the scan and the Kit find)
       make     the folder made under Marketing\ when there is none
       ext      'pdf' (drawn by the page) or 'png' (the map, sent ready-made)
       owners   'properties' (a listing) and/or 'pitches'; a pitch's folder is treated like a
                job's: its seller pitch and map go in its Marketing\Pitch\ (the browser may
                read Marketing\ back, never a folder's loose top-level files)
       page     (0017) the piece's own page, which the helper opens to make it from the job
                (piece-build.js); the map has none: Map Studio makes it with a person
       card     the extra address words that page needs (the Just Sold postcard)
     }

   piece.js, piece-build.js, piece-folder.js, archive.js and routes.js read this one table.
   ============================================================ */
'use strict';

const PITCH_DIR = /^(pitch|pitches|seller pitch|seller pitches)$/i;

const PIECES = {
  showsheet: { prefix: 'Showsheet', words: 'showsheet', folder: /^(showsheets?|show sheets?)$/i, make: 'Showsheet', ext: 'pdf', owners: ['properties'],
    page: '/tools/showsheet/' },
  brochure: { prefix: 'Brochure', words: 'brochure', folder: /^(brochure|brochures)$/i, make: 'Brochure', ext: 'pdf', owners: ['properties'],
    page: '/tools/brochure/' },
  'postcard-listed': { prefix: 'Just Listed Postcard', words: 'postcard', folder: /^(postcard|postcards)$/i, make: 'Postcard', ext: 'pdf', owners: ['properties'],
    page: '/tools/postcard/' },
  'postcard-sold': { prefix: 'Just Sold Postcard', words: 'postcard', folder: /^(postcard|postcards)$/i, make: 'Postcard', ext: 'pdf', owners: ['properties'],
    page: '/tools/postcard/', card: 'card=sold' },
  seller: { prefix: 'Seller Package', words: 'seller package', folder: PITCH_DIR, make: 'Pitch', ext: 'pdf', owners: ['properties', 'pitches'],
    page: '/tools/seller-package/' },
  'pitch-map': { prefix: 'Map', words: 'map', folder: PITCH_DIR, make: 'Pitch', ext: 'png', owners: ['properties', 'pitches'] },
  // Slice 6
  signage: { prefix: 'For Sale Sign', words: 'sign', folder: /^(signage|signs)$/i, make: 'Signage', ext: 'pdf', owners: ['properties'],
    page: '/tools/signage/' }
};

module.exports = { PIECES };
