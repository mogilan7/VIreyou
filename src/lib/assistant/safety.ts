export function extractAllNumbers(obj: any): Set<number> {
    const nums = new Set<number>();
    
    function traverse(item: any) {
        if (item === null || item === undefined) return;
        
        if (typeof item === 'number') {
            nums.add(item);
        } else if (typeof item === 'string') {
            const matches = item.match(/\d+/g);
            if (matches) {
                matches.forEach(m => nums.add(parseInt(m, 10)));
            }
        } else if (Array.isArray(item)) {
            item.forEach(traverse);
        } else if (typeof item === 'object') {
            Object.values(item).forEach(traverse);
        }
    }
    
    traverse(obj);
    return nums;
}

export function verifyNumbers(text: string, contract: any): { valid: boolean, invalidNumbers: number[] } {
    const textMatches = text.match(/\d+/g);
    if (!textMatches) {
        return { valid: true, invalidNumbers: [] };
    }
    
    const generatedNumbers = Array.from(new Set(textMatches.map(m => parseInt(m, 10))));
    const contractNumbers = extractAllNumbers(contract);
    
    const invalidNumbers: number[] = [];
    
    for (const num of generatedNumbers) {
        if (!contractNumbers.has(num)) {
            invalidNumbers.push(num);
        }
    }
    
    return {
        valid: invalidNumbers.length === 0,
        invalidNumbers
    };
}
