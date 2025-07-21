export const testTemplate = `
import { expect } from 'chai';
import { myFunction } from '../src/myModule'; // Adjust the import based on your module structure

describe('MyFunction Tests', () => {
    it('should return expected result for input 1', () => {
        const result = myFunction(1);
        expect(result).to.equal('expectedResult1'); // Replace with actual expected result
    });

    it('should return expected result for input 2', () => {
        const result = myFunction(2);
        expect(result).to.equal('expectedResult2'); // Replace with actual expected result
    });

    // Add more test cases as needed
});
`;