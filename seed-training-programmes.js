const mongoose = require('mongoose');
const Programme = require('./models/Programme');
const ExerciseLibrary = require('./models/ExerciseLibrary');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

// Programme templates with exercise selections
const programmeTemplates = [
  // BEGINNER PROGRAMMES (20)
  {
    name: 'Complete Beginner Full Body',
    description: 'Perfect for absolute beginners starting their fitness journey. Focuses on learning proper form and building a foundation.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'Strength',
    tags: ['beginner', 'full-body', 'foundation'],
    exercises: ['Push-ups', 'Goblet Squat', 'Lat Pulldown', 'Dumbbell Shoulder Press', 'Plank', 'Leg Press']
  },
  {
    name: 'Beginner Weight Loss Programme',
    description: 'Combination of strength training and cardio for effective fat loss and muscle toning.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Fat Loss',
    tags: ['weight-loss', 'cardio', 'toning'],
    exercises: ['Jumping Jacks', 'Burpees', 'Mountain Climbers', 'Goblet Squat', 'Dumbbell Curl', 'Plank', 'Treadmill Running']
  },
  {
    name: 'Gym Introduction Programme',
    description: 'Learn all the basic gym equipment and movements in a structured 4-week plan.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'General Fitness',
    tags: ['introduction', 'equipment-learning', 'basics'],
    exercises: ['Machine Chest Press', 'Lat Pulldown', 'Leg Press', 'Machine Shoulder Press', 'Leg Extension', 'Leg Curl', 'Crunches']
  },
  {
    name: 'Bodyweight Basics',
    description: 'No equipment needed! Master bodyweight fundamentals anywhere.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'Bodyweight',
    tags: ['bodyweight', 'no-equipment', 'home-workout'],
    exercises: ['Push-ups', 'Plank', 'Jumping Jacks', 'Crunches', 'Mountain Climbers', 'Bicycle Crunches', 'Wall Sit']
  },
  {
    name: 'Cardio Fitness Foundation',
    description: 'Build cardiovascular endurance and burn calories with beginner-friendly cardio exercises.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Cardio',
    tags: ['cardio', 'endurance', 'heart-health'],
    exercises: ['Treadmill Running', 'Rowing Machine', 'Jumping Jacks', 'Mountain Climbers', 'Stair Climber', 'Burpees']
  },
  {
    name: 'Upper Body Beginner',
    description: 'Focus on building upper body strength and muscle definition.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Strength',
    tags: ['upper-body', 'strength', 'muscle-building'],
    exercises: ['Push-ups', 'Lat Pulldown', 'Dumbbell Shoulder Press', 'Dumbbell Curl', 'Tricep Pushdown', 'Dumbbell Flyes', 'Cable Curl']
  },
  {
    name: 'Lower Body Foundation',
    description: 'Build strong legs and glutes with beginner-friendly lower body exercises.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Strength',
    tags: ['lower-body', 'legs', 'glutes'],
    exercises: ['Goblet Squat', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raises', 'Glute Bridge', 'Walking Lunges']
  },
  {
    name: 'Core Strength Starter',
    description: 'Develop a strong and stable core for better overall fitness and posture.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'Core',
    tags: ['core', 'abs', 'stability'],
    exercises: ['Plank', 'Crunches', 'Russian Twist', 'Dead Bug', 'Bicycle Crunches', 'Side Plank']
  },
  {
    name: '30-Day Transformation',
    description: 'Comprehensive 4-week programme to kickstart your fitness transformation.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'General Fitness',
    tags: ['transformation', 'full-body', '30-day'],
    exercises: ['Push-ups', 'Goblet Squat', 'Lat Pulldown', 'Plank', 'Walking Lunges', 'Dumbbell Curl', 'Mountain Climbers']
  },
  {
    name: 'Beginner Muscle Building',
    description: 'Start building lean muscle mass with proper form and progressive overload.',
    duration_in_weeks: 8,
    difficulty_level: 'Beginner',
    category: 'Hypertrophy',
    tags: ['muscle-building', 'mass-gain', 'hypertrophy'],
    exercises: ['Machine Chest Press', 'Lat Pulldown', 'Leg Press', 'Dumbbell Shoulder Press', 'Leg Curl', 'Barbell Curl', 'Tricep Pushdown']
  },
  {
    name: 'Morning Energy Boost',
    description: 'Quick morning workout to energize your day and boost metabolism.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'General Fitness',
    tags: ['morning', 'energy', 'quick-workout'],
    exercises: ['Jumping Jacks', 'Push-ups', 'Goblet Squat', 'Plank', 'Mountain Climbers']
  },
  {
    name: 'Functional Fitness Basics',
    description: 'Improve everyday movement patterns and functional strength.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Functional',
    tags: ['functional', 'movement', 'daily-life'],
    exercises: ['Goblet Squat', 'Step-ups', 'Push-ups', 'Walking Lunges', 'Plank', 'Dead Bug']
  },
  {
    name: 'Posture Correction Programme',
    description: 'Fix poor posture and reduce back pain with targeted exercises.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'Rehab',
    tags: ['posture', 'back-health', 'correction'],
    exercises: ['Face Pulls', 'Plank', 'Glute Bridge', 'Side Plank', 'Dead Bug', 'Lat Pulldown']
  },
  {
    name: 'Senior Fitness Programme',
    description: 'Safe and effective exercises for mature adults to maintain strength and mobility.',
    duration_in_weeks: 8,
    difficulty_level: 'Beginner',
    category: 'General Fitness',
    tags: ['seniors', 'safe', 'mobility'],
    exercises: ['Machine Chest Press', 'Leg Press', 'Seated Calf Raises', 'Lat Pulldown', 'Leg Extension', 'Resistance Band Chest Press']
  },
  {
    name: 'Women\'s Toning Programme',
    description: 'Designed for women looking to tone and sculpt their entire body.',
    duration_in_weeks: 8,
    difficulty_level: 'Beginner',
    category: 'Toning',
    tags: ['toning', 'womens-fitness', 'sculpting'],
    exercises: ['Glute Bridge', 'Lateral Raises', 'Goblet Squat', 'Walking Lunges', 'Push-ups', 'Plank', 'Bicycle Crunches']
  },
  {
    name: 'Men\'s Starter Programme',
    description: 'Build a strong foundation for muscle growth and strength.',
    duration_in_weeks: 8,
    difficulty_level: 'Beginner',
    category: 'Strength',
    tags: ['mens-fitness', 'strength', 'foundation'],
    exercises: ['Push-ups', 'Goblet Squat', 'Barbell Curl', 'Lat Pulldown', 'Tricep Pushdown', 'Leg Press', 'Plank']
  },
  {
    name: 'Flexibility & Mobility Starter',
    description: 'Improve range of motion, flexibility, and reduce injury risk.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'Flexibility',
    tags: ['flexibility', 'mobility', 'recovery'],
    exercises: ['Goblet Squat', 'Glute Bridge', 'Dead Bug', 'Plank', 'Walking Lunges']
  },
  {
    name: 'Weekend Warrior',
    description: 'Efficient full-body workouts for busy people who train on weekends.',
    duration_in_weeks: 6,
    difficulty_level: 'Beginner',
    category: 'General Fitness',
    tags: ['weekend', 'time-efficient', 'full-body'],
    exercises: ['Goblet Squat', 'Push-ups', 'Lat Pulldown', 'Burpees', 'Plank', 'Mountain Climbers']
  },
  {
    name: 'Desk Job Recovery',
    description: 'Combat the effects of prolonged sitting with targeted exercises.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'Rehab',
    tags: ['desk-job', 'sitting', 'recovery'],
    exercises: ['Glute Bridge', 'Face Pulls', 'Plank', 'Walking Lunges', 'Side Plank', 'Cat-Cow Stretch']
  },
  {
    name: 'Beginner HIIT Introduction',
    description: 'Introduction to High-Intensity Interval Training at a manageable pace.',
    duration_in_weeks: 4,
    difficulty_level: 'Beginner',
    category: 'HIIT',
    tags: ['hiit', 'intervals', 'fat-loss'],
    exercises: ['Jumping Jacks', 'Mountain Climbers', 'Burpees', 'Push-ups', 'Goblet Squat', 'Plank']
  },

  // INTERMEDIATE PROGRAMMES (40)
  {
    name: 'Push Pull Legs Split',
    description: 'Classic bodybuilding split for balanced muscle development and strength.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['ppl', 'muscle-building', 'bodybuilding'],
    exercises: ['Barbell Bench Press', 'Barbell Squat', 'Bent Over Barbell Row', 'Military Press', 'Deadlift', 'Pull-ups', 'Dips (Chest Focus)', 'Leg Curl']
  },
  {
    name: 'Upper Lower Split',
    description: 'Efficient 4-day split alternating between upper and lower body workouts.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Strength',
    tags: ['upper-lower', 'split-routine', 'strength'],
    exercises: ['Barbell Bench Press', 'Barbell Squat', 'Bent Over Barbell Row', 'Deadlift', 'Military Press', 'Front Squat', 'Pull-ups', 'Walking Lunges']
  },
  {
    name: 'Strength & Power Programme',
    description: 'Build explosive power and maximum strength with compound movements.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Strength',
    tags: ['strength', 'power', 'compound-movements'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Military Press', 'Power Clean', 'Box Jumps', 'Jump Squat']
  },
  {
    name: 'Athletic Performance',
    description: 'Enhance athletic performance with explosive and functional training.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Athletic',
    tags: ['athletic', 'performance', 'sports'],
    exercises: ['Box Jumps', 'Power Clean', 'Kettlebell Swing', 'Battle Ropes', 'Farmer\'s Walk', 'Sled Push', 'Burpees', 'Jump Squat']
  },
  {
    name: 'Hypertrophy Focus',
    description: 'Maximize muscle growth with volume training and progressive overload.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['hypertrophy', 'muscle-growth', 'volume-training'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Barbell Squat', 'Leg Press', 'Bent Over Barbell Row', 'T-Bar Row', 'Dumbbell Curl', 'Tricep Dips']
  },
  {
    name: 'Fat Shredding Programme',
    description: 'High-intensity training combined with resistance for maximum fat loss.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Fat Loss',
    tags: ['fat-loss', 'shredding', 'high-intensity'],
    exercises: ['Burpees', 'Kettlebell Swing', 'Battle Ropes', 'Thruster', 'Mountain Climbers', 'Rowing Machine', 'Medicine Ball Slam', 'Assault Bike']
  },
  {
    name: 'CrossFit Style WOD',
    description: 'Varied functional movements performed at high intensity.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'CrossFit',
    tags: ['crossfit', 'wod', 'functional-fitness'],
    exercises: ['Thruster', 'Pull-ups', 'Burpees', 'Kettlebell Swing', 'Box Jumps', 'Deadlift', 'Power Clean', 'Assault Bike']
  },
  {
    name: 'Beach Body Builder',
    description: 'Focus on aesthetic muscles for that summer beach body.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Aesthetic',
    tags: ['beach-body', 'aesthetic', 'summer'],
    exercises: ['Incline Dumbbell Press', 'Cable Crossovers', 'Lateral Raises', 'Pull-ups', 'Barbell Curl', 'Barbell Squat', 'Crunches', 'Plank']
  },
  {
    name: '5x5 Strength Programme',
    description: 'Classic 5x5 protocol for building raw strength and power.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Strength',
    tags: ['5x5', 'strength-training', 'powerlifting'],
    exercises: ['Barbell Squat', 'Barbell Bench Press', 'Deadlift', 'Military Press', 'Bent Over Barbell Row']
  },
  {
    name: 'Chest & Arms Specialization',
    description: 'Prioritize chest and arm development with focused training.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['chest', 'arms', 'upper-body'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Dips (Chest Focus)', 'Barbell Curl', 'Preacher Curl', 'Close Grip Bench Press', 'Skull Crushers']
  },
  {
    name: 'Back & Biceps Builder',
    description: 'Develop a thick, wide back with powerful biceps.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['back', 'biceps', 'pulling'],
    exercises: ['Deadlift', 'Pull-ups', 'Bent Over Barbell Row', 'T-Bar Row', 'Lat Pulldown', 'Barbell Curl', 'Hammer Curl', 'Preacher Curl']
  },
  {
    name: 'Legs & Glutes Focus',
    description: 'Build powerful legs and sculpted glutes.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['legs', 'glutes', 'lower-body'],
    exercises: ['Barbell Squat', 'Front Squat', 'Bulgarian Split Squat', 'Leg Press', 'Hip Thrust', 'Nordic Hamstring Curl', 'Walking Lunges', 'Calf Raises']
  },
  {
    name: 'Shoulder Specialization',
    description: 'Build cannonball delts with comprehensive shoulder training.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['shoulders', 'delts', 'upper-body'],
    exercises: ['Military Press', 'Arnold Press', 'Lateral Raises', 'Front Raises', 'Rear Delt Flyes', 'Upright Row', 'Face Pulls', 'Push Press']
  },
  {
    name: '30-Minute Warrior',
    description: 'Time-efficient high-intensity workouts for busy professionals.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'HIIT',
    tags: ['time-efficient', 'busy-professional', 'quick-workout'],
    exercises: ['Burpees', 'Kettlebell Swing', 'Thruster', 'Battle Ropes', 'Mountain Climbers', 'Jump Squat', 'Medicine Ball Slam']
  },
  {
    name: 'Endurance Athlete Training',
    description: 'Build stamina and muscular endurance for endurance sports.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Endurance',
    tags: ['endurance', 'stamina', 'cardio'],
    exercises: ['Rowing Machine', 'Assault Bike', 'Treadmill Running', 'Burpees', 'Kettlebell Swing', 'Mountain Climbers', 'Stair Climber']
  },
  {
    name: 'Metabolic Conditioning',
    description: 'Boost metabolism and burn fat with circuit-style training.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Conditioning',
    tags: ['metabolic', 'circuits', 'fat-burning'],
    exercises: ['Burpees', 'Kettlebell Swing', 'Battle Ropes', 'Medicine Ball Slam', 'Jump Squat', 'Mountain Climbers', 'Thruster', 'Rowing Machine']
  },
  {
    name: 'Core & Abs Definition',
    description: 'Sculpt a six-pack with advanced core training techniques.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Core',
    tags: ['abs', 'six-pack', 'core-strength'],
    exercises: ['Hanging Leg Raise', 'Ab Wheel Rollout', 'Russian Twist', 'Cable Woodchop', 'Mountain Climbers', 'Plank', 'V-Ups', 'Pallof Press']
  },
  {
    name: 'Functional Strength Builder',
    description: 'Real-world strength for everyday activities and sports.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Functional',
    tags: ['functional', 'real-world', 'practical'],
    exercises: ['Deadlift', 'Farmer\'s Walk', 'Turkish Get-Up', 'Kettlebell Swing', 'Thruster', 'Box Jumps', 'Battle Ropes']
  },
  {
    name: 'Olympic Lifting Programme',
    description: 'Master the Olympic lifts for explosive power and athleticism.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Olympic Lifting',
    tags: ['olympic-lifts', 'power', 'technique'],
    exercises: ['Clean and Jerk', 'Snatch', 'Power Clean', 'Front Squat', 'Deadlift', 'Military Press', 'Pull-ups']
  },
  {
    name: 'Bodyweight Mastery',
    description: 'Advanced bodyweight exercises for strength and control.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Bodyweight',
    tags: ['bodyweight', 'calisthenics', 'control'],
    exercises: ['Pull-ups', 'Dips (Chest Focus)', 'Weighted Push-ups', 'Pike Push-ups', 'Hanging Leg Raise', 'Burpees', 'L-Sit']
  },
  {
    name: 'Powerbuilding Programme',
    description: 'Combine powerlifting strength with bodybuilding aesthetics.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Powerbuilding',
    tags: ['powerbuilding', 'strength-aesthetics', 'hybrid'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Military Press', 'Bent Over Barbell Row', 'Incline Dumbbell Press', 'Barbell Curl', 'Skull Crushers']
  },
  {
    name: 'Total Body Transformation',
    description: 'Complete body recomposition programme for fat loss and muscle gain.',
    duration_in_weeks: 16,
    difficulty_level: 'Intermediate',
    category: 'Recomposition',
    tags: ['transformation', 'recomposition', 'complete-package'],
    exercises: ['Barbell Squat', 'Deadlift', 'Barbell Bench Press', 'Pull-ups', 'Military Press', 'Burpees', 'Kettlebell Swing', 'Battle Ropes', 'Mountain Climbers']
  },
  {
    name: 'Strongman Training',
    description: 'Build functional brute strength with strongman movements.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Strongman',
    tags: ['strongman', 'functional-strength', 'carry'],
    exercises: ['Deadlift', 'Farmer\'s Walk', 'Sled Push', 'Barbell Squat', 'Military Press', 'Battle Ropes', 'Tire Flips']
  },
  {
    name: 'Women\'s Strength & Curves',
    description: 'Build strength while sculpting feminine curves.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Hypertrophy',
    tags: ['womens-fitness', 'curves', 'strength'],
    exercises: ['Hip Thrust', 'Bulgarian Split Squat', 'Glute Bridge', 'Barbell Squat', 'Dumbbell Shoulder Press', 'Lat Pulldown', 'Cable Woodchop']
  },
  {
    name: 'Men\'s Physique Programme',
    description: 'Build the classic V-taper physique with wide shoulders and narrow waist.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Aesthetic',
    tags: ['mens-physique', 'v-taper', 'aesthetic'],
    exercises: ['Wide Grip Pull-ups', 'Lat Pulldown', 'Military Press', 'Lateral Raises', 'Incline Dumbbell Press', 'Cable Crossovers', 'Barbell Squat', 'Hanging Leg Raise']
  },
  {
    name: 'Marathon Prep Strength',
    description: 'Strength training specifically designed for marathon runners.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Endurance',
    tags: ['marathon', 'running', 'endurance-strength'],
    exercises: ['Bulgarian Split Squat', 'Single Leg Deadlift', 'Glute Bridge', 'Calf Raises', 'Plank', 'Side Plank', 'Walking Lunges']
  },
  {
    name: 'Explosive Power Development',
    description: 'Maximize explosive power for sports and athletics.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Power',
    tags: ['explosive', 'power', 'athletics'],
    exercises: ['Box Jumps', 'Power Clean', 'Jump Squat', 'Medicine Ball Slam', 'Kettlebell Swing', 'Burpees', 'Sled Push']
  },
  {
    name: 'Combat Sports Conditioning',
    description: 'Build strength, power, and endurance for combat athletes.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Athletic',
    tags: ['combat-sports', 'mma', 'conditioning'],
    exercises: ['Battle Ropes', 'Medicine Ball Slam', 'Burpees', 'Kettlebell Swing', 'Turkish Get-Up', 'Mountain Climbers', 'Assault Bike']
  },
  {
    name: 'Swim & Gym Combo',
    description: 'Complement your swimming with targeted gym training.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Athletic',
    tags: ['swimming', 'cross-training', 'triathlon'],
    exercises: ['Lat Pulldown', 'Face Pulls', 'Bulgarian Split Squat', 'Plank', 'Cable Woodchop', 'Dumbbell Shoulder Press']
  },
  {
    name: 'Cyclist Strength Programme',
    description: 'Leg strength and core stability for cycling performance.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Athletic',
    tags: ['cycling', 'leg-strength', 'endurance'],
    exercises: ['Barbell Squat', 'Bulgarian Split Squat', 'Single Leg Deadlift', 'Leg Press', 'Plank', 'Russian Twist', 'Calf Raises']
  },
  {
    name: 'Plyometric Power',
    description: 'Develop explosive jumping power and agility.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Plyometrics',
    tags: ['plyometrics', 'jumping', 'explosiveness'],
    exercises: ['Box Jumps', 'Jump Squat', 'Burpees', 'Medicine Ball Slam', 'Battle Ropes', 'Mountain Climbers']
  },
  {
    name: 'Peak Performance Programme',
    description: 'Optimize all aspects of fitness for peak physical performance.',
    duration_in_weeks: 16,
    difficulty_level: 'Intermediate',
    category: 'Athletic',
    tags: ['peak-performance', 'all-around', 'complete'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Pull-ups', 'Power Clean', 'Box Jumps', 'Burpees', 'Assault Bike']
  },
  {
    name: 'Vacation Ready Programme',
    description: 'Get in top shape before your beach vacation.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Aesthetic',
    tags: ['vacation', 'beach-ready', 'quick-results'],
    exercises: ['Burpees', 'Kettlebell Swing', 'Mountain Climbers', 'Barbell Squat', 'Incline Dumbbell Press', 'Lat Pulldown', 'Hanging Leg Raise', 'Battle Ropes']
  },
  {
    name: 'Gym & Yoga Balance',
    description: 'Combine strength training with flexibility for balanced fitness.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Hybrid',
    tags: ['yoga', 'flexibility', 'balance'],
    exercises: ['Goblet Squat', 'Bulgarian Split Squat', 'Dumbbell Shoulder Press', 'Lat Pulldown', 'Plank', 'Side Plank', 'Dead Bug']
  },
  {
    name: 'Mobility & Strength Combo',
    description: 'Build strength while maintaining and improving mobility.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Functional',
    tags: ['mobility', 'flexibility', 'strength'],
    exercises: ['Goblet Squat', 'Turkish Get-Up', 'Single Leg Deadlift', 'Kettlebell Swing', 'Face Pulls', 'Bulgarian Split Squat', 'Plank']
  },
  {
    name: 'Competition Prep',
    description: 'Final stage preparation for physique competitions.',
    duration_in_weeks: 12,
    difficulty_level: 'Intermediate',
    category: 'Bodybuilding',
    tags: ['competition', 'contest-prep', 'bodybuilding'],
    exercises: ['Barbell Bench Press', 'Barbell Squat', 'Deadlift', 'Pull-ups', 'Military Press', 'Cable Crossovers', 'Lateral Raises', 'Preacher Curl']
  },
  {
    name: 'Wedding Prep Programme',
    description: 'Look your absolute best for your wedding day.',
    duration_in_weeks: 16,
    difficulty_level: 'Intermediate',
    category: 'Aesthetic',
    tags: ['wedding', 'special-event', 'transformation'],
    exercises: ['Barbell Squat', 'Deadlift', 'Barbell Bench Press', 'Pull-ups', 'Military Press', 'Burpees', 'Kettlebell Swing', 'Mountain Climbers']
  },
  {
    name: 'Home Gym Advanced',
    description: 'Advanced training with minimal equipment at home.',
    duration_in_weeks: 10,
    difficulty_level: 'Intermediate',
    category: 'Home Training',
    tags: ['home-gym', 'minimal-equipment', 'efficient'],
    exercises: ['Pull-ups', 'Weighted Push-ups', 'Bulgarian Split Squat', 'Single Arm Dumbbell Row', 'Goblet Squat', 'Burpees', 'Hanging Leg Raise']
  },
  {
    name: 'Travel Workout Programme',
    description: 'Stay fit while traveling with hotel room workouts.',
    duration_in_weeks: 4,
    difficulty_level: 'Intermediate',
    category: 'Bodyweight',
    tags: ['travel', 'hotel-room', 'portable'],
    exercises: ['Push-ups', 'Burpees', 'Mountain Climbers', 'Plank', 'Jump Squat', 'Bulgarian Split Squat', 'Pike Push-ups']
  },
  {
    name: 'Recovery & Rebuild',
    description: 'Safely return to training after injury or time off.',
    duration_in_weeks: 8,
    difficulty_level: 'Intermediate',
    category: 'Rehab',
    tags: ['recovery', 'comeback', 'injury-prevention'],
    exercises: ['Goblet Squat', 'Glute Bridge', 'Lat Pulldown', 'Machine Chest Press', 'Leg Press', 'Face Pulls', 'Plank']
  },

  // ADVANCED PROGRAMMES (40+)
  {
    name: 'Advanced Powerlifting',
    description: 'Maximize your squat, bench press, and deadlift for competition.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Powerlifting',
    tags: ['powerlifting', 'competition', 'max-strength'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Front Squat', 'Rack Pulls', 'Close Grip Bench Press', 'Romanian Deadlift']
  },
  {
    name: 'Elite Bodybuilding',
    description: 'Professional-level bodybuilding programme for serious competitors.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Bodybuilding',
    tags: ['bodybuilding', 'professional', 'mass-building'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Barbell Squat', 'Leg Press', 'Deadlift', 'Pull-ups', 'Bent Over Barbell Row', 'T-Bar Row', 'Military Press', 'Lateral Raises']
  },
  {
    name: 'Beast Mode Strength',
    description: 'Ultimate strength programme for advanced lifters.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Strength',
    tags: ['extreme-strength', 'advanced', 'heavy-lifting'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Military Press', 'Weighted Pull-ups', 'Front Squat', 'Rack Pulls', 'Weighted Dips']
  },
  {
    name: 'Extreme Fat Loss',
    description: 'Aggressive fat loss programme with muscle preservation.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Fat Loss',
    tags: ['extreme-fat-loss', 'cutting', 'shredded'],
    exercises: ['Burpees', 'Thruster', 'Battle Ropes', 'Sled Push', 'Assault Bike', 'Kettlebell Swing', 'Medicine Ball Slam', 'Mountain Climbers', 'Deadlift', 'Barbell Squat']
  },
  {
    name: 'CrossFit Competition Prep',
    description: 'Prepare for CrossFit competitions with elite-level training.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'CrossFit',
    tags: ['crossfit-competition', 'elite', 'wod'],
    exercises: ['Clean and Jerk', 'Snatch', 'Thruster', 'Weighted Pull-ups', 'Handstand Push-ups', 'Box Jumps', 'Burpees', 'Assault Bike', 'Deadlift']
  },
  {
    name: 'Olympic Weightlifting Competition',
    description: 'Elite Olympic weightlifting programme for competitions.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Olympic Lifting',
    tags: ['olympic-lifting', 'competition', 'elite'],
    exercises: ['Clean and Jerk', 'Snatch', 'Power Clean', 'Front Squat', 'Deadlift', 'Military Press', 'Pull-ups', 'Box Jumps']
  },
  {
    name: 'Advanced Calisthenics',
    description: 'Master advanced bodyweight skills and strength.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Calisthenics',
    tags: ['calisthenics', 'bodyweight-mastery', 'skills'],
    exercises: ['Weighted Pull-ups', 'Weighted Dips', 'Handstand Push-ups', 'L-Sit', 'Pistol Squat', 'Dragon Flag', 'Muscle-ups']
  },
  {
    name: 'Superhuman Conditioning',
    description: 'Elite-level conditioning for peak athletic performance.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Conditioning',
    tags: ['elite-conditioning', 'endurance', 'performance'],
    exercises: ['Sled Push', 'Battle Ropes', 'Assault Bike', 'Burpees', 'Kettlebell Swing', 'Thruster', 'Rowing Machine', 'Medicine Ball Slam']
  },
  {
    name: 'Strongman Competition Prep',
    description: 'Prepare for strongman competitions with event-specific training.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Strongman',
    tags: ['strongman-competition', 'events', 'extreme-strength'],
    exercises: ['Deadlift', 'Farmer\'s Walk', 'Sled Push', 'Barbell Squat', 'Military Press', 'Battle Ropes', 'Atlas Stones']
  },
  {
    name: 'Advanced Athlete Training',
    description: 'Elite training for professional and semi-pro athletes.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Athletic',
    tags: ['professional-athlete', 'elite-performance', 'sports'],
    exercises: ['Power Clean', 'Snatch', 'Box Jumps', 'Sled Push', 'Battle Ropes', 'Deadlift', 'Barbell Squat', 'Burpees', 'Assault Bike']
  },
  {
    name: 'Hybrid Athlete Programme',
    description: 'Combine strength and endurance for the ultimate hybrid athlete.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Hybrid',
    tags: ['hybrid-athlete', 'strength-endurance', 'balanced'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Pull-ups', 'Assault Bike', 'Rowing Machine', 'Burpees', 'Kettlebell Swing']
  },
  {
    name: 'Muscle & Strength Mastery',
    description: 'Perfect balance of muscle size and maximum strength.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Powerbuilding',
    tags: ['muscle-and-strength', 'powerbuilding', 'advanced'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Military Press', 'Weighted Pull-ups', 'T-Bar Row', 'Incline Dumbbell Press', 'Front Squat']
  },
  {
    name: 'Spartacus Warrior Training',
    description: 'Build a warrior physique with intense functional training.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Functional',
    tags: ['warrior', 'spartan', 'functional-strength'],
    exercises: ['Deadlift', 'Kettlebell Swing', 'Battle Ropes', 'Sled Push', 'Farmer\'s Walk', 'Burpees', 'Turkish Get-Up', 'Medicine Ball Slam']
  },
  {
    name: '300 Spartan Workout',
    description: 'Legendary Spartan workout for ultimate conditioning.',
    duration_in_weeks: 8,
    difficulty_level: 'Advanced',
    category: 'HIIT',
    tags: ['spartan', '300', 'extreme-conditioning'],
    exercises: ['Pull-ups', 'Deadlift', 'Weighted Push-ups', 'Box Jumps', 'Kettlebell Swing', 'Burpees']
  },
  {
    name: 'Navy SEAL Training',
    description: 'Military-style training for mental and physical toughness.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Military',
    tags: ['military', 'seal', 'mental-toughness'],
    exercises: ['Weighted Pull-ups', 'Burpees', 'Weighted Push-ups', 'Sled Push', 'Farmer\'s Walk', 'Battle Ropes', 'Assault Bike', 'Mountain Climbers']
  },
  {
    name: 'Advanced HIIT Extreme',
    description: 'Maximum intensity interval training for elite fitness.',
    duration_in_weeks: 8,
    difficulty_level: 'Advanced',
    category: 'HIIT',
    tags: ['extreme-hiit', 'high-intensity', 'cardio'],
    exercises: ['Burpees', 'Thruster', 'Battle Ropes', 'Assault Bike', 'Sled Push', 'Box Jumps', 'Kettlebell Swing', 'Medicine Ball Slam']
  },
  {
    name: 'German Volume Training',
    description: 'Classic 10x10 protocol for massive muscle growth.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Hypertrophy',
    tags: ['gvt', '10x10', 'mass-building'],
    exercises: ['Barbell Squat', 'Deadlift', 'Barbell Bench Press', 'Pull-ups', 'Military Press', 'Bent Over Barbell Row']
  },
  {
    name: 'FST-7 Training',
    description: 'Fascia Stretch Training for extreme muscle pumps and growth.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Hypertrophy',
    tags: ['fst-7', 'pump', 'hypertrophy'],
    exercises: ['Incline Dumbbell Press', 'Cable Crossovers', 'Leg Press', 'Lat Pulldown', 'Cable Curl', 'Rope Tricep Extension', 'Lateral Raises']
  },
  {
    name: 'Smolov Squat Programme',
    description: 'Brutal squat-focused programme for massive leg gains.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Powerlifting',
    tags: ['smolov', 'squat-focus', 'leg-mass'],
    exercises: ['Barbell Squat', 'Front Squat', 'Deadlift', 'Leg Press', 'Bulgarian Split Squat']
  },
  {
    name: 'Westside Barbell Method',
    description: 'Legendary conjugate method for maximal strength.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Powerlifting',
    tags: ['westside', 'conjugate', 'max-effort'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Box Jumps', 'Weighted Pull-ups', 'Close Grip Bench Press']
  },
  {
    name: 'Tactical Athlete Training',
    description: 'Functional strength for tactical professionals.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Tactical',
    tags: ['tactical', 'functional', 'professional'],
    exercises: ['Deadlift', 'Farmer\'s Walk', 'Sled Push', 'Battle Ropes', 'Weighted Pull-ups', 'Burpees', 'Turkish Get-Up']
  },
  {
    name: 'MMA Fighter Conditioning',
    description: 'Complete conditioning for mixed martial arts fighters.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Combat Sports',
    tags: ['mma', 'fighting', 'combat'],
    exercises: ['Battle Ropes', 'Medicine Ball Slam', 'Burpees', 'Kettlebell Swing', 'Turkish Get-Up', 'Sled Push', 'Assault Bike', 'Box Jumps']
  },
  {
    name: 'Elite Endurance Programme',
    description: 'Build championship-level endurance and stamina.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Endurance',
    tags: ['elite-endurance', 'stamina', 'conditioning'],
    exercises: ['Assault Bike', 'Rowing Machine', 'Burpees', 'Kettlebell Swing', 'Battle Ropes', 'Sled Push', 'Thruster']
  },
  {
    name: 'Advanced Functional Fitness',
    description: 'Elite-level functional movements for real-world strength.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Functional',
    tags: ['functional-elite', 'real-world', 'practical'],
    exercises: ['Clean and Jerk', 'Snatch', 'Turkish Get-Up', 'Farmer\'s Walk', 'Sled Push', 'Deadlift', 'Kettlebell Swing']
  },
  {
    name: 'Ironman Triathlon Prep',
    description: 'Strength training to complement triathlon training.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Endurance',
    tags: ['triathlon', 'ironman', 'endurance-strength'],
    exercises: ['Bulgarian Split Squat', 'Single Leg Deadlift', 'Plank', 'Side Plank', 'Lat Pulldown', 'Face Pulls', 'Glute Bridge']
  },
  {
    name: 'Ultra Runner Strength',
    description: 'Build resilience and strength for ultra marathon running.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Endurance',
    tags: ['ultra-running', 'marathon', 'running-strength'],
    exercises: ['Bulgarian Split Squat', 'Single Leg Deadlift', 'Nordic Hamstring Curl', 'Glute Bridge', 'Calf Raises', 'Plank', 'Turkish Get-Up']
  },
  {
    name: 'Advanced Core Mastery',
    description: 'Elite core strength and stability training.',
    duration_in_weeks: 10,
    difficulty_level: 'Advanced',
    category: 'Core',
    tags: ['core-mastery', 'advanced-abs', 'stability'],
    exercises: ['Dragon Flag', 'Hanging Leg Raise', 'Ab Wheel Rollout', 'L-Sit', 'Turkish Get-Up', 'Pallof Press', 'Cable Woodchop']
  },
  {
    name: 'Peak Aesthetics',
    description: 'Achieve peak muscular development and symmetry.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Bodybuilding',
    tags: ['peak-aesthetics', 'symmetry', 'definition'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Barbell Squat', 'Deadlift', 'Wide Grip Pull-ups', 'Lateral Raises', 'Preacher Curl']
  },
  {
    name: 'Super Soldier Programme',
    description: 'Build superhuman strength, endurance, and power.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Military',
    tags: ['super-soldier', 'complete-fitness', 'elite'],
    exercises: ['Deadlift', 'Barbell Squat', 'Weighted Pull-ups', 'Burpees', 'Sled Push', 'Battle Ropes', 'Farmer\'s Walk', 'Assault Bike', 'Box Jumps']
  },
  {
    name: 'Advanced Mobility & Strength',
    description: 'Combine elite strength with superior mobility.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Functional',
    tags: ['mobility-strength', 'movement-quality', 'functional'],
    exercises: ['Pistol Squat', 'Turkish Get-Up', 'Single Leg Deadlift', 'Kettlebell Swing', 'Deadlift', 'Front Squat', 'Handstand Push-ups']
  },
  {
    name: 'Explosive Athletic Power',
    description: 'Maximum explosive power for elite athletics.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Power',
    tags: ['explosive-power', 'athletics', 'performance'],
    exercises: ['Clean and Jerk', 'Snatch', 'Power Clean', 'Box Jumps', 'Medicine Ball Slam', 'Sled Push', 'Jump Squat']
  },
  {
    name: 'Advanced Push Pull Legs',
    description: 'Elite version of the classic PPL split with advanced techniques.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Bodybuilding',
    tags: ['ppl-advanced', 'volume-training', 'split'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Weighted Dips', 'Deadlift', 'Weighted Pull-ups', 'T-Bar Row', 'Barbell Squat', 'Front Squat', 'Nordic Hamstring Curl']
  },
  {
    name: 'Elite Strength & Size',
    description: 'Maximum muscle mass and strength combined.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Powerbuilding',
    tags: ['elite-mass', 'strength-size', 'complete'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Military Press', 'Weighted Pull-ups', 'Bent Over Barbell Row', 'Front Squat', 'Incline Dumbbell Press']
  },
  {
    name: 'Competition Bodybuilding',
    description: 'Professional bodybuilding prep for stage competition.',
    duration_in_weeks: 24,
    difficulty_level: 'Advanced',
    category: 'Bodybuilding',
    tags: ['competition', 'stage-ready', 'professional'],
    exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Pec Deck Machine', 'Deadlift', 'Barbell Squat', 'Leg Press', 'Leg Extension', 'Wide Grip Pull-ups', 'T-Bar Row']
  },
  {
    name: 'Ultimate Transformation',
    description: 'Complete body transformation for advanced athletes.',
    duration_in_weeks: 24,
    difficulty_level: 'Advanced',
    category: 'Transformation',
    tags: ['ultimate-transformation', 'complete-change', 'advanced'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Pull-ups', 'Military Press', 'Burpees', 'Assault Bike', 'Battle Ropes', 'Sled Push', 'Kettlebell Swing']
  },
  {
    name: 'Advanced Fat Loss & Muscle',
    description: 'Aggressive fat loss while maintaining/building muscle.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Recomposition',
    tags: ['fat-loss-muscle', 'recomp', 'shredded'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Weighted Pull-ups', 'Burpees', 'Thruster', 'Battle Ropes', 'Assault Bike']
  },
  {
    name: 'Powerlifting Peaking Programme',
    description: 'Final 8 weeks before a powerlifting competition.',
    duration_in_weeks: 8,
    difficulty_level: 'Advanced',
    category: 'Powerlifting',
    tags: ['peaking', 'competition-prep', 'maximal-strength'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Rack Pulls', 'Front Squat', 'Close Grip Bench Press']
  },
  {
    name: 'Advanced Kettlebell Training',
    description: 'Master advanced kettlebell movements for strength and conditioning.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'Kettlebell',
    tags: ['kettlebell-mastery', 'functional', 'conditioning'],
    exercises: ['Turkish Get-Up', 'Kettlebell Swing', 'Clean and Jerk', 'Snatch', 'Goblet Squat', 'Single Leg Deadlift']
  },
  {
    name: 'Elite Obstacle Course Racing',
    description: 'Prepare for Spartan Race, Tough Mudder, and OCR events.',
    duration_in_weeks: 12,
    difficulty_level: 'Advanced',
    category: 'OCR',
    tags: ['ocr', 'spartan-race', 'obstacle-racing'],
    exercises: ['Weighted Pull-ups', 'Farmer\'s Walk', 'Burpees', 'Box Jumps', 'Sled Push', 'Battle Ropes', 'Deadlift', 'Assault Bike']
  },
  {
    name: 'Advanced Women\'s Training',
    description: 'Elite training programme designed for advanced female athletes.',
    duration_in_weeks: 16,
    difficulty_level: 'Advanced',
    category: 'Womens Fitness',
    tags: ['womens-elite', 'female-athletes', 'advanced'],
    exercises: ['Hip Thrust', 'Barbell Squat', 'Deadlift', 'Weighted Pull-ups', 'Bulgarian Split Squat', 'Nordic Hamstring Curl', 'Military Press', 'Battle Ropes']
  },
  {
    name: 'Elite Men\'s Programme',
    description: 'Professional-level training for elite male athletes.',
    duration_in_weeks: 20,
    difficulty_level: 'Advanced',
    category: 'Mens Fitness',
    tags: ['mens-elite', 'professional', 'complete'],
    exercises: ['Deadlift', 'Barbell Squat', 'Barbell Bench Press', 'Weighted Pull-ups', 'Military Press', 'Power Clean', 'Snatch', 'Assault Bike']
  }
];

async function seedProgrammes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found. Please create an admin first.');
      process.exit(1);
    }

    // Get all exercises
    const allExercises = await ExerciseLibrary.find({ is_active: true });
    if (allExercises.length === 0) {
      console.log('❌ No exercises found. Please run seed-exercise-library.js first.');
      process.exit(1);
    }

    console.log(`✅ Found ${allExercises.length} exercises in library\n`);

    console.log('🗑️  Clearing existing programmes...');
    await Programme.deleteMany({});

    console.log('📚 Creating comprehensive training programmes...\n');

    let created = 0;
    for (const programmeTemplate of programmeTemplates) {
      // Find exercises by name and format them correctly
      const exercises = [];
      let order = 1;
      
      for (const exerciseName of programmeTemplate.exercises) {
        const exercise = allExercises.find(ex => ex.name === exerciseName);
        if (exercise) {
          // Determine sets and reps based on difficulty and exercise type
          let sets = 3;
          let reps = '10-12';
          let rest = 60;
          
          if (programmeTemplate.difficulty_level === 'Beginner') {
            sets = 2;
            reps = '12-15';
            rest = 90;
          } else if (programmeTemplate.difficulty_level === 'Advanced') {
            sets = 4;
            reps = '8-10';
            rest = 45;
          }
          
          // Adjust for exercise type
          if (exercise.muscle_group === 'core') {
            sets = 3;
            reps = '15-20';
            rest = 45;
          } else if (exercise.muscle_group === 'full_body') {
            sets = 3;
            reps = '12';
            rest = 90;
          }
          
          exercises.push({
            exercise: exercise._id,
            sets: sets,
            reps: reps,
            duration_minutes: exercise.muscle_group === 'full_body' ? 20 : 0,
            rest_seconds: rest,
            order: order++
          });
        }
      }

      const programme = new Programme({
        name: programmeTemplate.name,
        description: programmeTemplate.description,
        duration_in_weeks: programmeTemplate.duration_in_weeks,
        difficulty_level: programmeTemplate.difficulty_level,
        category: programmeTemplate.category,
        tags: programmeTemplate.tags,
        exercises: exercises,
        created_by: admin._id,
        isActive: true
      });

      await programme.save();
      created++;
      
      if (created % 10 === 0) {
        console.log(`✅ Created ${created} programmes...`);
      }
    }

    console.log(`\n✅ Successfully created ${created} training programmes!`);
    
    // Print summary
    const summary = await Programme.aggregate([
      { $group: { 
        _id: '$difficulty_level', 
        count: { $sum: 1 },
        categories: { $addToSet: '$category' }
      }},
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Training Programme Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    summary.forEach(group => {
      console.log(`\n${group._id} Level: ${group.count} programmes`);
      console.log(`Categories: ${group.categories.join(', ')}`);
    });

    const categorySummary = await Programme.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } }},
      { $sort: { count: -1 } }
    ]);

    console.log('\n📋 By Category:');
    categorySummary.forEach(cat => {
      console.log(`  ${cat._id}: ${cat.count} programmes`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedProgrammes();

