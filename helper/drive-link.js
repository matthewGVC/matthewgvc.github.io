/* ============================================================
   DRIVE LINK — the real drive.google.com link of a file or folder on G:.

   Google Drive for Desktop keeps each item's Drive id in an NTFS alternate
   data stream beside it, named "user.drive.id". Reading that stream is the
   whole job: nothing is opened, written or moved (D7).

     driveLink(abs, isFolder) → 'https://drive.google.com/drive/folders/<id>'
                              | 'https://drive.google.com/file/d/<id>/view'
                              | null   (no stream, off Windows, or an odd id)

   Just after a file is written, Drive for Desktop holds a stand-in id there
   ("local-249850") until the upload lands, about a minute later: that is no
   id yet, so null (piece.js writePiece waits for the real one).
   ============================================================ */
'use strict';

const fs = require('fs');
const ID = /^[A-Za-z0-9_-]{10,}$/;

function driveLink(abs, isFolder) {
  let id;
  try { id = fs.readFileSync(abs + ':user.drive.id', 'utf8').trim(); } catch (e) { return null; }
  if (!ID.test(id) || /^local-/i.test(id)) return null;
  return isFolder ? 'https://drive.google.com/drive/folders/' + id : 'https://drive.google.com/file/d/' + id + '/view';
}

module.exports = { driveLink };
