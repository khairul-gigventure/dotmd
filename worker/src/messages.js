export const ERROR_MESSAGES = {
  "bad-url": "Link ni tak sah. Semak dan cuba lagi.",
  "unsupported-url": "Link jenis ni tak disokong.",
  blocked: "Site ni block pengambilan dari server. Cuba buka di browser desktop dan guna extension DotMD.",
  timeout: "Site ambil masa terlalu lama. Cuba lagi sekejap lagi.",
  "too-large": "Page ni terlalu besar untuk ditukar.",
  "not-html": "Link ni bukan page web biasa.",
  "no-article": "Tak jumpa article di page ni.",
  "private-or-missing": "Post ni private, dipadam, atau tak boleh dibaca tanpa login.",
  "fetch-failed": "Gagal ambil page ni. Cuba lagi.",
  internal: "Ada masalah di server DotMD. Cuba lagi.",
};

export const ERROR_STATUS = {
  "bad-url": 400,
  "unsupported-url": 400,
  blocked: 502,
  timeout: 504,
  "too-large": 413,
  "not-html": 415,
  "no-article": 422,
  "private-or-missing": 404,
  "fetch-failed": 502,
  internal: 500,
};
