const crypto = require("crypto");
const fs = require("fs");

function writeInputJson(privateData) {
  function ascii(str) {
    return Array.from(str).map(c => c.charCodeAt(0));
  }

  const input = {
    pubName: ascii(privateData.name),
    pubSurname: ascii(privateData.surname),
    commitment: privateData.commitment.map(x => x.toString()),

    privDate: ascii(privateData.date_of_birth),
    privLicense: [privateData.license_category.charCodeAt(0)],
    privExpDate: ascii(privateData.expiration_date),
    nonce: ascii(privateData.nonce)
  };

  fs.writeFileSync("input.json", JSON.stringify(input, null, 2));
  console.log("\n📝 Fichier input.json généré pour snarkjs !");
}


// Compute SHA-256 and split into two 128-bit integers
function computeCommitment(inputString) {
  const hash = crypto.createHash("sha256").update(inputString).digest(); // Buffer of 32 bytes
  const left = hash.subarray(0, 16);  // first 16 bytes
  const right = hash.subarray(16);   // last 16 bytes
  return [
    BigInt('0x' + left.toString('hex')).toString(),
    BigInt('0x' + right.toString('hex')).toString()
  ];
}

// Register a user
function registerUser(name, surname, dob, licenseCategory, expDate) {
  const nonce = crypto.randomBytes(4).toString("hex"); // 8 chars
  const concat = `${name}${surname}${dob}${licenseCategory}${expDate}${nonce}`;
  const commitment = computeCommitment(concat);

  const userPublic = {
    name,
    surname,
    commitment
  };

  const userPrivate = {
    name,
    surname,
    date_of_birth: dob,
    license_category: licenseCategory,
    expiration_date: expDate,
    nonce,
    commitment
  };

  // Save to public registry
  let db = [];
  const file = "data/public_registry.json";
  if (fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file));
  }
  db.push(userPublic);
  fs.writeFileSync(file, JSON.stringify(db, null, 2));

  // Print private data
  console.log("Utilisateur enregistré dans le registre public.");
  console.log("Données privées (à transmettre à l'utilisateur) :\n");
  console.log(JSON.stringify(userPrivate, null, 2));
  
  writeInputJson(userPrivate);
}

// Example usage
registerUser("Jean", "Durand", "2000-01-01", "A", "2026-01-01");
