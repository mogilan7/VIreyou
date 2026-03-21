import { analyzeFoodWithAI } from '../src/lib/telegram/ai-services';

async function test() {
    try {
        const text = "Также сегодня я съел одну порцию риса.";
        const result = await analyzeFoodWithAI(undefined, text);
        console.log("GPT Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
