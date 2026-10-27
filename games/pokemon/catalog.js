"use strict";
window.pokemonGames = [
 ['red','Red','gambatte','gb'],['blue','Blue','gambatte','gb'],['green','Green','gambatte','gb'],['yellow','Yellow','gambatte','gb'],
 ['gold','Gold','gambatte','gbc'],['silver','Silver','gambatte','gbc'],['crystal','Crystal','gambatte','gbc'],
 ['ruby','Ruby','mgba','gba'],['sapphire','Sapphire','mgba','gba'],['emerald','Emerald','mgba','gba'],['firered','FireRed','mgba','gba'],['leafgreen','LeafGreen','mgba','gba']
].map(([slug,version,core,extension],index) => ({slug,title:'Pokémon '+version,core,extension,id:101+index}));
