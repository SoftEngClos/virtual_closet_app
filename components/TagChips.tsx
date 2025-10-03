import React, {useState} from "react";
import {View, TextInput, Text, Pressable, StyleSheet} from "react-native";

export default function TagChips({
    tags, 
    onAdd,
    onRemove,
}: {
    tags: string[];
    onAdd: (t: string) => void;
    onRemove: (t: string) => void;
}) {
    const [input, setInput] = useState("");

    function submit() {
        const t = input.trim();
        if(t) onAdd(t);
        setInput("");
    }

    return(
        <View style={s.wrap}>
            <View style = {s.row}>
                {tags?.map((t) => (
                    <Pressable key = {t} onLongPress={() => onRemove(t)} style = {s.chip}>
                        <Text style={s.chipText}>#{t} </Text>
                    </Pressable>
                ))}
            </View>
                <View style={s.addRow}>
                    <TextInput
                    value = {input}
                    onChangeText = {setInput}
                    onSubmitEditing={submit}
                    placeholder="add a tag (press enter)"
                    style={s.input}
                    />

                </View>
            </View>           
    );
}

const s = StyleSheet.create({
    wrap: {gap:8},
    row: {flexDirection: "row", flexWrap: "wrap", gap:8},
    chip: {backgroundColor: "#eee", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
    chipText: {fontSize: 12},
    addRow: {},
    input: {borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10},
});