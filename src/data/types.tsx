type GoalID = number

interface Goal {
    goalID: GoalID;
    description: string;
    isComplete: Boolean;
    parent: Goal | undefined;
    children: Goal[];
    excess: Boolean;

    deadline: Deadline | undefined;
    counters?: Record<string, Counter>;
    Reward: Reward;
    // may have to return previous instance of prop for log
    update_description: (new_description: string) => void;
    // goal's step function
    toggle_complete: ()=> Boolean;
    update_parent: (new_parent: GoalID) => void;
    add_child: (child: GoalID) => void;
    remove_child: (child: GoalID) => void;
    // may not be needed
    isLeaf: ()=> Boolean;
}

// simple rule with a simple step function that utlizes the complete/incomplete modifiers
interface Dynamic_Rule<T, V> {
    property: T;
    complete_incomplete_modifiers: [V, V];
    step: (complete: Boolean, excess: Boolean) => T;
    update_prop: (new_value: T) => void;
    update_modifier: (complete: V, incomplete: V) => void;
}

enum Gap {
    ONE_TIME,
    DAILY,
    WEEKLY,
    MONTHLY,
    YEARLY
}

interface Deadline extends Dynamic_Rule<Date, Gap>{
    final_deadline: Date;
    update_final: (new_final: Date) => void;
    is_retired: ()=>Boolean;

}

// may need to optimize later
interface Counter extends Dynamic_Rule<number, number>{
    min_max: [number, number];
    // may want to separate
    update_min_max: (min: number, max: number) => void;
}


// could be just static or maybe some additional function to make reward more complex
// may make reward function dependent on other factors such as counters
// min is always 0, and max may be unbounded
interface Reward extends Dynamic_Rule<number, number>{    
}


type streak = 1 | 2 | 3 | 4 | 5;
// could make multiplier dependent on completion rate, min is always 0
interface Multiplier extends Dynamic_Rule<streak, null>{

}


type BlockID = number;
interface Block{
    // may need to furthur restrict number from 0-24 or just do checks later
    blockID: BlockID;
    interval: [number, number];
    goals: GoalID[];
    multiplier: Multiplier;
    change_beginning: (b: number)=>void;
    change_ending: (e: number) => void;
    add_goal: (goal: GoalID)=>void;
    remove_goal: (goal: GoalID)=>void;
}

interface Schedule{
    blocks: BlockID[];
    swap: (id1: number, id2: number) => void;
    add_block: (id:number, block: BlockID)=>void;
    remove_block:(id: number) => BlockID;
}


interface Planner{
    time: Date
}

/*
7/28
Need to do final check-up of types
still iffy on multiplier and reward as dynamic rule and their design

create planner type and logger type
need to add comments
*/ 