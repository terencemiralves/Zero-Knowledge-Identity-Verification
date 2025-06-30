/**
 * Convertit une chaîne en tableau ASCII de taille fixe
 */
export function stringToAsciiArray(str, length) {
    const arr = new Array(length).fill(0);
    for (let i = 0; i < Math.min(str.length, length); i++) {
        arr[i] = str.charCodeAt(i);
    }
    return arr;
}

/**
 * Formate une date au format YYYY-MM-DD en tableau ASCII
 */
export function formatDateToAscii(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error("Format de date invalide. Utilisez YYYY-MM-DD");
    }
    return stringToAsciiArray(dateStr, 10);
}

/**
 * Valide le format d'une date
 */
export function validateDate(input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return 'Format de date invalide. Utilisez YYYY-MM-DD';
    }
    
    const date = new Date(input);
    const [year, month, day] = input.split('-').map(Number);
    
    if (date.getFullYear() !== year || 
        date.getMonth() !== month - 1 || 
        date.getDate() !== day) {
        return 'Date invalide';
    }
    
    return true;
}

/**
 * Valide un nom (max 16 caractères)
 */
export function validateName(input) {
    if (!input || input.trim().length === 0) {
        return 'Le nom ne peut pas être vide';
    }
    
    if (input.length > 16) {
        return 'Le nom ne peut pas dépasser 16 caractères';
    }
    
    return true;
}

/**
 * Affiche un spinner avec un message
 */
export function createSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    return setInterval(() => {
        process.stdout.write(`\r${frames[i]} ${message}`);
        i = (i + 1) % frames.length;
    }, 100);
}

/**
 * Efface la ligne courante
 */
export function clearLine() {
    process.stdout.write('\r\x1b[K');
}

/**
 * Convertit les signaux publics en informations lisibles
 */
export function parsePublicSignals(signals) {
    return {
        hasLicenseA: signals[0] === '1' || signals[0] === 1,
        raw: signals
    };
}

/**
 * Valide le format JSON
 */
export function validateJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return 'JSON invalide';
    }
}

/**
 * Formate la taille d'un fichier
 */
export function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Obtient les informations d'un fichier
 */
export async function getFileInfo(filePath) {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    try {
        const stats = await fs.stat(filePath);
        return {
            exists: true,
            size: formatFileSize(stats.size),
            modified: stats.mtime.toISOString(),
            name: path.basename(filePath),
            extension: path.extname(filePath)
        };
    } catch {
        return {
            exists: false
        };
    }
}