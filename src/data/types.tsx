// more general types for refactoring
type Update<T> = (prop: T) => void;
type Get<T> = () => T
interface Updatable<T> { 
    prop: T;
    update: Update<T>;
    get: Get<T>;
}

type Add<T> = (prop: T) =>void;
type Remove<T> = (prop:T) => void;

interface Interative_list<T> {
    prop: T[];
    add_prop: Add<T>;
    remove_prop: Remove<number>;
}

// may not work
type Is<T> = (para?: T)=> Boolean;

type ID = number;

interface Steppable<T>{
    step: (complete:Boolean, excess:Boolean)=>T;
}

// goal types
type GoalID = ID
interface Goal extends Steppable<Goal>{
    goalID: GoalID;
    description: Updatable<String>;
    isComplete: Updatable<Boolean>;
    parent: Updatable<Goal> | undefined;
    children: Interative_list<Goal>;
    excess: Updatable<Boolean>;

    deadline: Deadline | undefined;
    counters?: Record<string, Counter>;
    Reward: Reward;
    // may have to return previous instance of prop for log
    // goal's step function
    // may not be needed
    is_leaf: Is<null>;
}

// simple rule with a simple step function that utlizes the complete/incomplete modifiers
interface Dynamic_Rule<T, V> extends Steppable<T>{
    property: Updatable<T>;
    complete_modifiers: Updatable<V>;
    incomplete_modifier: Updatable<V>;
}

enum Gap {
    ONE_TIME,
    DAILY,
    WEEKLY,
    MONTHLY,
    YEARLY
}

interface Deadline extends Dynamic_Rule<Date, Gap>{
    final_deadline: Updatable<Date>;
    is_retired: Is<null>;
}

interface Counter extends Dynamic_Rule<number, number>{
    min: Updatable<number>;
    max: Updatable<number>
}


// could be just static or maybe some additional function to make reward more complex
// may make reward function dependent on other factors such as counters
// min is always 0, and max may be unbounded
interface Reward extends Dynamic_Rule<number, number>{    
}


type streak = 1 | 2 | 3 | 4 | 5;
// could make multiplier dependent on completion rate, min is always 0
interface Multiplier extends Dynamic_Rule<streak, number>{

}



type TemplateID = ID;
interface Template{
    name: Updatable<string>;
    templateID: TemplateID;
}

interface Empty_Block{
    duration: number;
}

type Block_TemplateID = TemplateID
interface Block_Template extends Template, Empty_Block, Steppable<Block_Template>{
    // may need to furthur restrict number from 0-24 or just do checks later
    templateID: Block_TemplateID
    goals: Interative_list<GoalID>;
    
    multiplier: Multiplier;
    update_duration: Update<number>;

}

type ScheduleID = TemplateID
interface Schedule_Template extends Template{
    templateID: ScheduleID;
    // may have to fix
    block_list: Interative_list<Block_Template | Empty_Block>;
    swap: (idx1: number, idx2: number) => void;
    schedule: (start:Date) => Block[]
}

type SchedulableID = ID;
interface Schedulable{
    // may not be a good idea
    schedulableID: SchedulableID;
    start_end: Updatable<[number, number]>;

}
interface Block extends Schedulable{
    reference_template: Updatable<Block_Template>;
    task_list: Interative_list<Goal>;
    is_active: Is<Date>;
    
}



// the doers or simulators of the object
// in charge of scheduling a template onto a "calendar," keep track of dynamic states, and allow user to complete tasks
interface Planner{
    // previous instance of Date
    time: Date
    // pseudo calendar
    calendar: Block[];
    goal_trees: Goal[];
    
    // each check of time, planner should check goals referenced in block and step each goal
    // also check block template 
    update: ()=>void;

}

/*


7/29
need to fix general type Is and check if general type is too restrictive or not
need to double check types
need to plan out planner, logs, and loggers

7/28
Need to do final check-up of types
still iffy on multiplier and reward as dynamic rule and their design

create planner type and logger type
need to add comments
*/ 