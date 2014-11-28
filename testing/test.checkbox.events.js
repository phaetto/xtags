{
    ready: function() {
        var checked = (this.Data["isChecked"] === "true");
        this.$().attr("checked", checked);
    }
}