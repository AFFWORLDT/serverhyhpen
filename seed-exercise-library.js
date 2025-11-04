const mongoose = require('mongoose');
const ExerciseLibrary = require('./models/ExerciseLibrary');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

// Comprehensive exercise database organized by muscle group
const exercises = [
  // CHEST EXERCISES (20)
  { name: 'Barbell Bench Press', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Bench', calories_burned_per_minute: 8, description: 'Classic compound movement for overall chest development' },
  { name: 'Incline Dumbbell Press', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells, Incline Bench', calories_burned_per_minute: 7, description: 'Targets upper chest and shoulders' },
  { name: 'Decline Bench Press', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Decline Bench', calories_burned_per_minute: 8, description: 'Emphasizes lower chest development' },
  { name: 'Dumbbell Flyes', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Dumbbells, Bench', calories_burned_per_minute: 6, description: 'Isolation exercise for chest stretch and squeeze' },
  { name: 'Cable Crossovers', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 6, description: 'Great for inner chest definition' },
  { name: 'Push-ups', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 8, description: 'Classic bodyweight exercise for chest, shoulders, and triceps' },
  { name: 'Weighted Push-ups', muscle_group: 'chest', difficulty_level: 'Advanced', equipment_required: 'Weight Plate', calories_burned_per_minute: 10, description: 'Advanced variation with added resistance' },
  { name: 'Dips (Chest Focus)', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Dip Station', calories_burned_per_minute: 9, description: 'Compound movement targeting lower chest' },
  { name: 'Incline Cable Flyes', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Cable Machine, Incline Bench', calories_burned_per_minute: 6, description: 'Targets upper chest with constant tension' },
  { name: 'Machine Chest Press', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Chest Press Machine', calories_burned_per_minute: 7, description: 'Safe and controlled chest press variation' },
  { name: 'Pec Deck Machine', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Pec Deck Machine', calories_burned_per_minute: 5, description: 'Isolation exercise for chest contraction' },
  { name: 'Landmine Press', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Landmine', calories_burned_per_minute: 7, description: 'Unique angle for upper chest development' },
  { name: 'Diamond Push-ups', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 9, description: 'Emphasizes inner chest and triceps' },
  { name: 'Wide Grip Push-ups', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 7, description: 'Targets outer chest muscles' },
  { name: 'Incline Push-ups', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Bench', calories_burned_per_minute: 6, description: 'Easier variation for beginners' },
  { name: 'Decline Push-ups', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Bench', calories_burned_per_minute: 9, description: 'Advanced variation targeting upper chest' },
  { name: 'Single Arm Dumbbell Press', muscle_group: 'chest', difficulty_level: 'Advanced', equipment_required: 'Dumbbell, Bench', calories_burned_per_minute: 8, description: 'Unilateral chest press for core stability' },
  { name: 'Resistance Band Chest Press', muscle_group: 'chest', difficulty_level: 'Beginner', equipment_required: 'Resistance Bands', calories_burned_per_minute: 5, description: 'Portable chest exercise with bands' },
  { name: 'Svend Press', muscle_group: 'chest', difficulty_level: 'Intermediate', equipment_required: 'Weight Plates', calories_burned_per_minute: 6, description: 'Isometric chest squeeze exercise' },
  { name: 'Chest Dips (Weighted)', muscle_group: 'chest', difficulty_level: 'Advanced', equipment_required: 'Dip Station, Weight Belt', calories_burned_per_minute: 11, description: 'Advanced weighted dips for mass' },

  // BACK EXERCISES (20)
  { name: 'Deadlift', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 12, description: 'King of all exercises for overall back development' },
  { name: 'Pull-ups', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Pull-up Bar', calories_burned_per_minute: 10, description: 'Compound bodyweight exercise for back width' },
  { name: 'Bent Over Barbell Row', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 9, description: 'Classic rowing movement for back thickness' },
  { name: 'Lat Pulldown', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Lat Pulldown Machine', calories_burned_per_minute: 7, description: 'Machine alternative to pull-ups' },
  { name: 'Seated Cable Row', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 7, description: 'Mid-back development exercise' },
  { name: 'T-Bar Row', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'T-Bar, Barbell', calories_burned_per_minute: 9, description: 'Thick back builder' },
  { name: 'Single Arm Dumbbell Row', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Dumbbell, Bench', calories_burned_per_minute: 7, description: 'Unilateral back exercise' },
  { name: 'Face Pulls', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 5, description: 'Rear delt and upper back exercise' },
  { name: 'Wide Grip Pull-ups', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Pull-up Bar', calories_burned_per_minute: 11, description: 'Emphasizes lat width' },
  { name: 'Chin-ups', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Pull-up Bar', calories_burned_per_minute: 10, description: 'Underhand grip variation for biceps and lats' },
  { name: 'Inverted Row', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Smith Machine or Barbell', calories_burned_per_minute: 7, description: 'Bodyweight rowing alternative' },
  { name: 'Romanian Deadlift', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 9, description: 'Lower back and hamstring developer' },
  { name: 'Hyperextensions', muscle_group: 'back', difficulty_level: 'Beginner', equipment_required: 'Hyperextension Bench', calories_burned_per_minute: 6, description: 'Lower back isolation exercise' },
  { name: 'Sumo Deadlift', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 12, description: 'Wide stance deadlift variation' },
  { name: 'Pendlay Row', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 10, description: 'Explosive rowing variation' },
  { name: 'Chest Supported Row', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Incline Bench, Dumbbells', calories_burned_per_minute: 7, description: 'Eliminates lower back stress' },
  { name: 'Meadows Row', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Barbell, Landmine', calories_burned_per_minute: 9, description: 'Single arm rowing variation' },
  { name: 'Weighted Pull-ups', muscle_group: 'back', difficulty_level: 'Advanced', equipment_required: 'Pull-up Bar, Weight Belt', calories_burned_per_minute: 12, description: 'Progressive overload for pull-ups' },
  { name: 'Rack Pulls', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Power Rack', calories_burned_per_minute: 10, description: 'Partial deadlift for upper back' },
  { name: 'Seal Row', muscle_group: 'back', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Elevated Bench', calories_burned_per_minute: 8, description: 'Removes momentum from rowing' },

  // SHOULDERS (15)
  { name: 'Military Press', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 8, description: 'Classic overhead press for shoulders' },
  { name: 'Dumbbell Shoulder Press', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Dumbbells', calories_burned_per_minute: 7, description: 'Seated or standing shoulder press' },
  { name: 'Lateral Raises', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Dumbbells', calories_burned_per_minute: 5, description: 'Isolation for side delts' },
  { name: 'Front Raises', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Dumbbells or Barbell', calories_burned_per_minute: 5, description: 'Front deltoid isolation' },
  { name: 'Rear Delt Flyes', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Dumbbells', calories_burned_per_minute: 5, description: 'Targets rear deltoids' },
  { name: 'Arnold Press', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells', calories_burned_per_minute: 8, description: 'Rotation press for complete shoulder development' },
  { name: 'Upright Row', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'Barbell or Dumbbells', calories_burned_per_minute: 7, description: 'Compound shoulder and trap exercise' },
  { name: 'Handstand Push-ups', muscle_group: 'shoulders', difficulty_level: 'Advanced', equipment_required: 'Wall', calories_burned_per_minute: 11, description: 'Advanced bodyweight shoulder press' },
  { name: 'Push Press', muscle_group: 'shoulders', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 10, description: 'Explosive overhead press variation' },
  { name: 'Cable Lateral Raises', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 5, description: 'Constant tension lateral raises' },
  { name: 'Machine Shoulder Press', muscle_group: 'shoulders', difficulty_level: 'Beginner', equipment_required: 'Shoulder Press Machine', calories_burned_per_minute: 6, description: 'Guided shoulder press movement' },
  { name: 'Plate Raises', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'Weight Plate', calories_burned_per_minute: 6, description: 'Front raise variation with plate' },
  { name: 'Bradford Press', muscle_group: 'shoulders', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 9, description: 'Behind and front neck press combination' },
  { name: 'Pike Push-ups', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 8, description: 'Bodyweight shoulder press variation' },
  { name: 'Landmine Press', muscle_group: 'shoulders', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Landmine', calories_burned_per_minute: 7, description: 'Single arm overhead press' },

  // LEGS (25)
  { name: 'Barbell Squat', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Squat Rack', calories_burned_per_minute: 12, description: 'King of leg exercises' },
  { name: 'Front Squat', muscle_group: 'legs', difficulty_level: 'Advanced', equipment_required: 'Barbell, Squat Rack', calories_burned_per_minute: 12, description: 'Quad-focused squat variation' },
  { name: 'Leg Press', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Leg Press Machine', calories_burned_per_minute: 10, description: 'Machine-based leg compound' },
  { name: 'Bulgarian Split Squat', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells, Bench', calories_burned_per_minute: 9, description: 'Single leg squat variation' },
  { name: 'Leg Extension', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Leg Extension Machine', calories_burned_per_minute: 6, description: 'Quadriceps isolation' },
  { name: 'Leg Curl', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Leg Curl Machine', calories_burned_per_minute: 6, description: 'Hamstring isolation' },
  { name: 'Walking Lunges', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Dumbbells (optional)', calories_burned_per_minute: 8, description: 'Dynamic leg exercise' },
  { name: 'Goblet Squat', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Dumbbell or Kettlebell', calories_burned_per_minute: 9, description: 'Beginner-friendly squat' },
  { name: 'Hack Squat', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Hack Squat Machine', calories_burned_per_minute: 11, description: 'Machine squat for quads' },
  { name: 'Step-ups', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Bench, Dumbbells (optional)', calories_burned_per_minute: 8, description: 'Functional leg exercise' },
  { name: 'Box Jumps', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Plyo Box', calories_burned_per_minute: 12, description: 'Explosive leg power' },
  { name: 'Calf Raises', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Smith Machine or Dumbbells', calories_burned_per_minute: 5, description: 'Calf muscle isolation' },
  { name: 'Seated Calf Raises', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Calf Raise Machine', calories_burned_per_minute: 4, description: 'Soleus muscle focus' },
  { name: 'Sissy Squat', muscle_group: 'legs', difficulty_level: 'Advanced', equipment_required: 'Sissy Squat Bench', calories_burned_per_minute: 8, description: 'Advanced quad isolation' },
  { name: 'Nordic Hamstring Curl', muscle_group: 'legs', difficulty_level: 'Advanced', equipment_required: 'Partner or Bench', calories_burned_per_minute: 9, description: 'Eccentric hamstring exercise' },
  { name: 'Pistol Squat', muscle_group: 'legs', difficulty_level: 'Advanced', equipment_required: 'None', calories_burned_per_minute: 10, description: 'Single leg squat' },
  { name: 'Jump Squat', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 13, description: 'Explosive squat variation' },
  { name: 'Sumo Squat', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Dumbbell', calories_burned_per_minute: 9, description: 'Wide stance squat for inner thighs' },
  { name: 'Reverse Lunge', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Dumbbells (optional)', calories_burned_per_minute: 7, description: 'Knee-friendly lunge variation' },
  { name: 'Leg Press Calf Raise', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Leg Press Machine', calories_burned_per_minute: 5, description: 'Calf exercise on leg press' },
  { name: 'Good Morning', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 8, description: 'Hamstring and lower back exercise' },
  { name: 'Glute Bridge', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 6, description: 'Glute activation exercise' },
  { name: 'Hip Thrust', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Bench', calories_burned_per_minute: 8, description: 'Glute hypertrophy exercise' },
  { name: 'Wall Sit', muscle_group: 'legs', difficulty_level: 'Beginner', equipment_required: 'Wall', calories_burned_per_minute: 6, description: 'Isometric quad exercise' },
  { name: 'Single Leg Deadlift', muscle_group: 'legs', difficulty_level: 'Intermediate', equipment_required: 'Dumbbell', calories_burned_per_minute: 7, description: 'Balance and hamstring exercise' },

  // ARMS - Biceps (12)
  { name: 'Barbell Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Barbell', calories_burned_per_minute: 5, description: 'Classic bicep mass builder' },
  { name: 'Dumbbell Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Dumbbells', calories_burned_per_minute: 5, description: 'Versatile bicep exercise' },
  { name: 'Hammer Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Dumbbells', calories_burned_per_minute: 5, description: 'Targets brachialis and forearms' },
  { name: 'Preacher Curl', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Preacher Bench, Barbell or Dumbbells', calories_burned_per_minute: 5, description: 'Isolated bicep curl' },
  { name: 'Cable Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 5, description: 'Constant tension bicep curl' },
  { name: 'Concentration Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Dumbbell, Bench', calories_burned_per_minute: 4, description: 'Peak contraction bicep exercise' },
  { name: '21s', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 6, description: 'High intensity bicep workout' },
  { name: 'Incline Dumbbell Curl', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells, Incline Bench', calories_burned_per_minute: 5, description: 'Stretch-focused bicep curl' },
  { name: 'Zottman Curl', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells', calories_burned_per_minute: 5, description: 'Bicep and forearm combination' },
  { name: 'Spider Curl', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Incline Bench', calories_burned_per_minute: 5, description: 'Isolated bicep peak exercise' },
  { name: 'Reverse Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Barbell', calories_burned_per_minute: 5, description: 'Forearm and brachialis focus' },
  { name: 'EZ Bar Curl', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'EZ Curl Bar', calories_burned_per_minute: 5, description: 'Wrist-friendly bicep curl' },

  // ARMS - Triceps (10)
  { name: 'Close Grip Bench Press', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Barbell, Bench', calories_burned_per_minute: 7, description: 'Compound tricep exercise' },
  { name: 'Tricep Dips', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Dip Station', calories_burned_per_minute: 8, description: 'Bodyweight tricep builder' },
  { name: 'Overhead Tricep Extension', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Dumbbell', calories_burned_per_minute: 5, description: 'Long head tricep focus' },
  { name: 'Tricep Pushdown', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Cable Machine', calories_burned_per_minute: 5, description: 'Isolation tricep exercise' },
  { name: 'Skull Crushers', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'Barbell or EZ Bar, Bench', calories_burned_per_minute: 6, description: 'Lying tricep extension' },
  { name: 'Diamond Push-ups', muscle_group: 'arms', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 8, description: 'Tricep-focused push-up' },
  { name: 'Rope Tricep Extension', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Cable Machine, Rope', calories_burned_per_minute: 5, description: 'Tricep definition exercise' },
  { name: 'Dumbbell Kickback', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Dumbbell, Bench', calories_burned_per_minute: 4, description: 'Tricep isolation movement' },
  { name: 'JM Press', muscle_group: 'arms', difficulty_level: 'Advanced', equipment_required: 'Barbell, Bench', calories_burned_per_minute: 7, description: 'Hybrid press/extension for triceps' },
  { name: 'Bench Dips', muscle_group: 'arms', difficulty_level: 'Beginner', equipment_required: 'Bench', calories_burned_per_minute: 6, description: 'Bodyweight tricep exercise' },

  // CORE/ABS (15)
  { name: 'Plank', muscle_group: 'core', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 5, description: 'Isometric core strengthener' },
  { name: 'Crunches', muscle_group: 'core', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 4, description: 'Basic abdominal exercise' },
  { name: 'Russian Twist', muscle_group: 'core', difficulty_level: 'Intermediate', equipment_required: 'Medicine Ball (optional)', calories_burned_per_minute: 6, description: 'Oblique rotational exercise' },
  { name: 'Hanging Leg Raise', muscle_group: 'core', difficulty_level: 'Advanced', equipment_required: 'Pull-up Bar', calories_burned_per_minute: 8, description: 'Advanced lower ab exercise' },
  { name: 'Cable Woodchop', muscle_group: 'core', difficulty_level: 'Intermediate', equipment_required: 'Cable Machine', calories_burned_per_minute: 6, description: 'Rotational core exercise' },
  { name: 'Ab Wheel Rollout', muscle_group: 'core', difficulty_level: 'Advanced', equipment_required: 'Ab Wheel', calories_burned_per_minute: 7, description: 'Full core engagement' },
  { name: 'Mountain Climbers', muscle_group: 'core', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 10, description: 'Dynamic core and cardio' },
  { name: 'Dead Bug', muscle_group: 'core', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 4, description: 'Core stability exercise' },
  { name: 'Bicycle Crunches', muscle_group: 'core', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 5, description: 'Oblique and abs combination' },
  { name: 'Dragon Flag', muscle_group: 'core', difficulty_level: 'Advanced', equipment_required: 'Bench', calories_burned_per_minute: 9, description: 'Advanced full core exercise' },
  { name: 'L-Sit', muscle_group: 'core', difficulty_level: 'Advanced', equipment_required: 'Parallel Bars or Floor', calories_burned_per_minute: 7, description: 'Isometric core hold' },
  { name: 'Side Plank', muscle_group: 'core', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 5, description: 'Oblique strengthener' },
  { name: 'Pallof Press', muscle_group: 'core', difficulty_level: 'Intermediate', equipment_required: 'Cable Machine', calories_burned_per_minute: 5, description: 'Anti-rotation core exercise' },
  { name: 'V-Ups', muscle_group: 'core', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 6, description: 'Full abdominal contraction' },
  { name: 'Turkish Get-Up', muscle_group: 'core', difficulty_level: 'Advanced', equipment_required: 'Kettlebell', calories_burned_per_minute: 8, description: 'Full body core stabilizer' },

  // CARDIO/FULL BODY (15)
  { name: 'Burpees', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'None', calories_burned_per_minute: 15, description: 'High-intensity full body exercise' },
  { name: 'Jumping Jacks', muscle_group: 'full_body', difficulty_level: 'Beginner', equipment_required: 'None', calories_burned_per_minute: 8, description: 'Classic cardio warm-up' },
  { name: 'Battle Ropes', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Battle Ropes', calories_burned_per_minute: 12, description: 'High-intensity upper body cardio' },
  { name: 'Kettlebell Swing', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Kettlebell', calories_burned_per_minute: 13, description: 'Explosive hip hinge movement' },
  { name: 'Rowing Machine', muscle_group: 'full_body', difficulty_level: 'Beginner', equipment_required: 'Rowing Machine', calories_burned_per_minute: 11, description: 'Low-impact cardio' },
  { name: 'Assault Bike', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Assault Bike', calories_burned_per_minute: 14, description: 'High-intensity bike intervals' },
  { name: 'Sled Push', muscle_group: 'full_body', difficulty_level: 'Advanced', equipment_required: 'Prowler Sled', calories_burned_per_minute: 16, description: 'Explosive leg and cardio power' },
  { name: 'Farmer\'s Walk', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Dumbbells or Kettlebells', calories_burned_per_minute: 9, description: 'Grip and core strength' },
  { name: 'Thruster', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Barbell', calories_burned_per_minute: 14, description: 'Squat to overhead press combo' },
  { name: 'Clean and Jerk', muscle_group: 'full_body', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 15, description: 'Olympic lift for power' },
  { name: 'Snatch', muscle_group: 'full_body', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 16, description: 'Olympic explosive movement' },
  { name: 'Power Clean', muscle_group: 'full_body', difficulty_level: 'Advanced', equipment_required: 'Barbell', calories_burned_per_minute: 14, description: 'Explosive pulling movement' },
  { name: 'Medicine Ball Slam', muscle_group: 'full_body', difficulty_level: 'Intermediate', equipment_required: 'Medicine Ball', calories_burned_per_minute: 12, description: 'Explosive full body movement' },
  { name: 'Treadmill Running', muscle_group: 'full_body', difficulty_level: 'Beginner', equipment_required: 'Treadmill', calories_burned_per_minute: 10, description: 'Classic cardio exercise' },
  { name: 'Stair Climber', muscle_group: 'full_body', difficulty_level: 'Beginner', equipment_required: 'Stair Climber Machine', calories_burned_per_minute: 11, description: 'Leg-focused cardio' },
];

async function seedExerciseLibrary() {
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

    console.log('🗑️  Clearing existing exercises...');
    await ExerciseLibrary.deleteMany({});

    console.log('📚 Creating comprehensive exercise library...\n');

    let created = 0;
    for (const exerciseData of exercises) {
      const exercise = new ExerciseLibrary({
        ...exerciseData,
        created_by: admin._id,
        is_active: true
      });
      await exercise.save();
      created++;
      
      if (created % 20 === 0) {
        console.log(`✅ Created ${created} exercises...`);
      }
    }

    console.log(`\n✅ Successfully created ${created} exercises!`);
    
    // Print summary
    const summary = await ExerciseLibrary.aggregate([
      { $group: { 
        _id: '$muscle_group', 
        count: { $sum: 1 },
        beginner: { $sum: { $cond: [{ $eq: ['$difficulty_level', 'Beginner'] }, 1, 0] } },
        intermediate: { $sum: { $cond: [{ $eq: ['$difficulty_level', 'Intermediate'] }, 1, 0] } },
        advanced: { $sum: { $cond: [{ $eq: ['$difficulty_level', 'Advanced'] }, 1, 0] } }
      }},
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Exercise Library Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    summary.forEach(group => {
      console.log(`\n${group._id.toUpperCase()}: ${group.count} exercises`);
      console.log(`  Beginner: ${group.beginner} | Intermediate: ${group.intermediate} | Advanced: ${group.advanced}`);
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

seedExerciseLibrary();

