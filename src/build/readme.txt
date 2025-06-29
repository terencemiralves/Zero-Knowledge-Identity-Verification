Bon la team ca marche a moitier, en gros sa gen un witness et une proof et tout mais jsp trop comment check que ca marche (genre que c'est pas content si on met un permis B au lieu du A).
Bref, en gros on a deux trois fichier important ici,
./licenseA.circom     - Le cricom
./genWitness.js       - Le generateur d'input pour witness (explication plus bas)
./licenseA_js/        - Dossier avec le generateur de witness
...                   - Le reste peut etre generer a partir de ses fichier (conseiller de prendre un pto18 c'est ce que j'avais perso)

En gros faut gen la zkey et tout (classic), une fois que c'est fait il faut run le genWitness.js (s'il faut modif le user generer faut le modif direct dedans) ca va cree un input.json avec les infos necessaire. Apres il faut run:

node LicenseA_js/generate_witness.js LicenseA_js/LicenseA.wasm input.json witness.wtns

Ce qui va cree un witness (witness.wtns)

Et avec ca on cree une proof avec ca:

snarkjs groth16 prove LicenseA_final.zkey witness.wtns proof.json public.json

Le proof.json est la proof et le public.json est le public outupt (genre si le gars a son permis A il y aura une liste avec un element a 1 sinon l'element sera a 0 (je vous encourage a tester pour mieux capter)).

Et voila ca marche. Faudrais l'automatiser ce serait cool.

Phill_Lewis
