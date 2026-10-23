/* ============================================================
   PIECES — every piece the helper writes into a job's folder (spec Slice 5 S3, D95).

     PIECES[tool] = {
       prefix   the file name's first words ("Showsheet - <Address Unit> - <date>.pdf")
       words    how the piece is named in a sentence ("older brochure left in place: …")
       folder   the folder it goes in, looked for in Marketing\ first, then the job's top
                (the same names folder-health.js counts as that piece's folder)
       make     the folder made under Marketing\ when there is none
       ext      'pdf' (drawn by the page) or 'png' (the map, sent ready-made)
       owners   'properties' (a listing) and/or 'pitches'; a pitch's folder is treated like a
                job's: its seller pitch and map go in its Marketing\Pitch\ (the browser may
                read Marketing\ back, never a folder's loose top-level files)
     }

   piece.js, piece-folder.js, archive.js and routes.js read this one table.
   ============================================================ */
'use strict';

const PITCH_DIR = /^(pitch|pitches|seller pitch|seller pitches)$/i;

const PIECES = {
  showsheet: { prefix: 'Showsheet', words: 'showsheet', folder: /^(showsheets?|show sheets?)$/i, make: 'Showsheet', ext: 'pdf', owners: ['properties'] },
  brochure: { prefix: 'Brochure', words: 'brochure', folder: /^brochures?\b/i, make: 'Brochure', ext: 'pdf', owners: ['properties'] },
  'postcard-listed': { prefix: 'Just Listed Postcard', words: 'postcard', folder: /^postcards?\b/i, make: 'Postcard', ext: 'pdf', owners: ['properties'] },
  'postcard-sold': { prefix: 'Just Sold Postcard', words: 'postcard', folder: /^postcards?\b/i, make: 'Postcard', ext: 'pdf', owners: ['properties'] },
  seller: { prefix: 'Seller Pitch', words: 'seller pitch', folder: PITCH_DIR, make: 'Pitch', ext: 'pdf', owners: ['properties', 'pitches'] },
  'pitch-map': { prefix: 'Map', words: 'map', folder: PITCH_DIR, make: 'Pitch', ext: 'png', owners: ['properties', 'pitches'] },
  // Slice 6
  'open-house': { prefix: 'Open House Flyer', words: 'open house flyer', folder: /^open house\b/i, make: 'Open House', ext: 'pdf', owners: ['properties'] },
  signage: { prefix: 'For Sale Sign', words: 'sign', folder: /^(signage|signs?)\b/i, make: 'Signage', ext: 'pdf', owners: ['properties'] }
};

module.exports = { PIECES };
