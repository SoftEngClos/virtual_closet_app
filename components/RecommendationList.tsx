// components/RecommendationList.tsx
import React from "react";
import { View, Text, Image, TouchableOpacity, FlatList } from "react-native";
import { rankOutfits, type Outfit, type UserPreferences, type RecContext } from "../hooks/useRecommendations";

export default function RecommendationList({
  outfits, prefs, ctx, onPress,
}:{
  outfits: Outfit[];
  prefs: UserPreferences;
  ctx: RecContext;
  onPress?: (o:Outfit)=>void;
}) {
  const recs = rankOutfits(outfits, ctx, prefs, 10);
  return (
    <FlatList
      data={recs}
      keyExtractor={(r)=>r.outfit.id}
      renderItem={({item})=>(
        <TouchableOpacity onPress={()=>onPress?.(item.outfit)}>
          <View style={{flexDirection:"row",alignItems:"center",padding:12}}>
            {item.outfit.thumbnailUrl ? (
              <Image source={{uri:item.outfit.thumbnailUrl}} style={{width:56,height:56,borderRadius:8,marginRight:12}} />
            ) : <View style={{width:56,height:56,borderRadius:8,marginRight:12,backgroundColor:"#ddd"}}/>}
            <View style={{flex:1}}>
              <Text style={{fontWeight:"600"}}>{item.outfit.name}</Text>
              <Text numberOfLines={1} style={{opacity:0.7, fontSize:12}}>
                {item.outfit.tags.join(" • ")}
              </Text>
            </View>
            <Text style={{opacity:0.6}}>{item.score.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
