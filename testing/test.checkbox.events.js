{
    ready: function() {
        var checked = (this.Data["isChecked"] === "true");
        console.log(this.Data["isChecked"]);
        this.$().attr("checked", checked);
    }
}